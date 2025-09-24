import { LogLevel, TelemetryEvent } from "../common/telemetry/TelemetryConstants";
import { TelemetryHelper } from "../common/telemetry/TelemetryHelper";
import { FacadeChatSDK } from "../common/facades/FacadeChatSDK";
import { Constants } from "../common/Constants";

// Azure AI Language Text Analytics API
interface AzureTextAnalyticsConfig {
    endpoint?: string;
    apiKey?: string;
    timeout?: number;
    enabled?: boolean;
}

interface CSATResult {
    csatScore: number;
    confidence: number;
    sentiment: "positive" | "negative" | "neutral";
    satisfactionLevel: string;
    reasoning?: string;
}

interface ChatMessage {
    content: string;
    sender: "customer" | "agent" | "bot";
    timestamp: string;
}

interface SDKMessage {
    content?: string;
    text?: string;
    messageType?: string;
    sender?: string;
    timestamp?: string;
    createdDateTime?: string;
    from?: {
        user?: {
            displayName?: string;
            id?: string;
        };
        application?: {
            displayName?: string;
            id?: string;
        };
    };
    tags?: string;
    isControlMessage?: boolean;
}

// Azure Text Analytics response interface
interface AzureTextAnalyticsResponse {
    kind?: string;
    results?: {
        documents: Array<{
            id: string;
            sentiment: "positive" | "negative" | "neutral" | "mixed";
            confidenceScores: {
                positive: number;
                negative: number;
                neutral: number;
            };
            sentences: Array<{
                sentiment: string;
                confidenceScores: {
                    positive: number;
                    negative: number;
                    neutral: number;
                };
                text: string;
            }>;
        }>;
        errors?: Array<{
            id: string;
            error: {
                code: string;
                message: string;
            };
        }>;
    };
}

/**
 * Sentiment Analytics Service - Supports multiple AI providers for customer sentiment analysis
 */
export class SentimentAnalyticsService {
    private static readonly DEFAULT_CONFIG: AzureTextAnalyticsConfig = {
        // Azure Text Analytics endpoint and key - super simple setup!
        endpoint: "https://chat-sentiment-analytics.cognitiveservices.azure.com",
        apiKey: "<API_KEY>",
        timeout: 10000,
        enabled: true
    };

    /**
     * Convert technical sentiment to user-friendly satisfaction levels
     */
    private static mapSentimentToSatisfaction(sentiment: string, csatScore: number): string {
        // Map based on CSAT score for more precise satisfaction levels
        if (csatScore === 5) {
            return "Very Satisfied";
        } else if (csatScore === 4) {
            return "Satisfied";
        } else if (csatScore === 3) {
            return "Neutral";
        } else if (csatScore === 2) {
            return "Dissatisfied";
        } else if (csatScore === 1) {
            return "Very Dissatisfied";
        } else {
            // Fallback to sentiment-based mapping for edge cases
            if (sentiment === "positive") return "Satisfied";
            if (sentiment === "negative") return "Dissatisfied";
            return "Neutral";
        }
    }

    /**
     * Main entry point for Azure Text Analytics sentiment analysis
     * @param facadeChatSDK - SDK instance to fetch chat transcript
     * @param config - Optional configuration override
     * @returns Promise<CSATResult | null>
     */
    static async analyzeSentiments(
        facadeChatSDK: FacadeChatSDK, 
        config?: AzureTextAnalyticsConfig
    ): Promise<CSATResult | null> {
        const effectiveConfig = { ...this.DEFAULT_CONFIG, ...config };

        try {
            // Validate configuration
            if (!effectiveConfig.enabled || !effectiveConfig.endpoint || !effectiveConfig.apiKey) {
                return null;
            }

            // Get chat transcript
            const chatTranscript = await this.getChatTranscript(facadeChatSDK);
            if (!chatTranscript || chatTranscript.length === 0) {
                return null;
            }

            // Call Azure Text Analytics
            const result = await this.callAzureTextAnalytics(chatTranscript, effectiveConfig);
            
            if (!result) {
                TelemetryHelper.logActionEvent(LogLevel.WARN, {
                    Event: TelemetryEvent.CSATAnalysisFailed,
                    Description: "Azure Text Analytics failed to analyze sentiment",
                    CustomProperties: {
                        error: "No result returned from Azure Text Analytics",
                        transcriptLength: chatTranscript.length.toString(),
                        analysisTimestamp: new Date().toISOString()
                    }
                });
                return null;
            }
            
            // Log successful analysis with CustomProperties
            TelemetryHelper.logActionEvent(LogLevel.INFO, {
                Event: TelemetryEvent.CSATAnalysisCompleted,
                Description: "Customer sentiment CSAT analysis completed successfully",
                CustomProperties: {
                    csatScore: result.csatScore.toString(),
                    confidence: result.confidence.toFixed(3),
                    sentiment: result.sentiment,
                    satisfactionLevel: result.satisfactionLevel,
                    reasoning: result.reasoning || "No reasoning provided"
                }
            });
            
            return result;

        } catch (error) {
            TelemetryHelper.logActionEvent(LogLevel.ERROR, {
                Event: TelemetryEvent.CSATAnalysisFailed,
                Description: "Azure Text Analytics sentiment analysis failed during chat end",
                CustomProperties: {
                    errorMessage: error instanceof Error ? error.message : "Unknown error",
                    errorType: error instanceof Error ? error.constructor.name : "UnknownError",
                    analysisTimestamp: new Date().toISOString(),
                    chatEndProceedSuccessfully: "false"
                }
            });
            
            return null;
        }
    }

    /**
     * Extract chat messages from SDK
     */
    private static async getChatTranscript(facadeChatSDK: FacadeChatSDK): Promise<ChatMessage[]> {
        try {
            let transcriptResponse = await facadeChatSDK.getLiveChatTranscript();

            if (typeof (transcriptResponse) === Constants.String) {
                transcriptResponse = JSON.parse(transcriptResponse);
            }
            
            let messages = transcriptResponse?.chatMessagesJson || transcriptResponse?.messages || [];
            
            if (typeof messages === "string") {
                try {
                    messages = JSON.parse(messages);
                } catch (error) {
                    messages = [];
                }
            }
            
            if (!Array.isArray(messages) && transcriptResponse && typeof transcriptResponse === "object") {
                if (transcriptResponse.chatMessagesJson) {
                    if (typeof transcriptResponse.chatMessagesJson === "string") {
                        try {
                            messages = JSON.parse(transcriptResponse.chatMessagesJson);
                        } catch (error) {
                            messages = [];
                        }
                    } else if (Array.isArray(transcriptResponse.chatMessagesJson)) {
                        messages = transcriptResponse.chatMessagesJson;
                    }
                }
            }
            
            if (!Array.isArray(messages)) {
                messages = [];
            }
            
            const filteredMessages = messages
                .filter((message: SDKMessage) => {
                    if (message.isControlMessage) return false;
                    if (!message.content || message.content.trim().length === 0) return false;
                    if (message.tags?.includes("system") || message.tags?.includes("agentassignmentready")) return false;
                    return true;
                })
                .map((message: SDKMessage) => ({
                    content: message.content || "",
                    sender: this.determineSender(message),
                    timestamp: message.createdDateTime || message.timestamp || new Date().toISOString()
                }));
                
            return filteredMessages;

        } catch (error) {
            return [];
        }
    }

    /**
     * Determine message sender type based on transcript structure
     */
    private static determineSender(message: SDKMessage): "customer" | "agent" | "bot" {
        // Check tags first - most reliable indicator
        if (message.tags?.includes("FromCustomer") || message.tags?.includes("ChannelId-lcw")) {
            return "customer";
        }
        
        // Check from.application - indicates customer messages
        if (message.from?.application?.displayName === "Customer") {
            return "customer";
        }
        
        // Check from.user - could be bot or agent
        if (message.from?.user?.displayName) {
            const displayName = message.from.user.displayName.toLowerCase();
            // Bot indicators
            if (displayName.includes("bot") || displayName.includes("virtual") || displayName.includes("power virtual agents")) {
                return "bot";
            }
            // Agent indicators  
            if (displayName.includes("agent") || message.from.user.displayName === "__agent__") {
                return "agent";
            }
        }
        
        // Fallback to original logic
        if (message.messageType === "customer" || message.sender === "customer") return "customer";
        if (message.messageType === "agent" || message.sender === "agent") return "agent";
        
        // Default to bot for system messages
        return "bot";
    }

    /**
     * Call Azure Text Analytics API (Microsoft's built-in service)
     */
    private static async callAzureTextAnalytics(
        chatTranscript: ChatMessage[], 
        config: AzureTextAnalyticsConfig
    ): Promise<CSATResult | null> {
        const { endpoint, apiKey, timeout } = config;
        
        // Combine all messages into conversation context
        let conversationText = chatTranscript
            .map(msg => `${msg.sender}: ${msg.content}`)
            .join("\n");

        // Azure Text Analytics has a limit of 5,120 text elements per document
        // Truncate if too long, prioritizing recent messages
        const MAX_TEXT_LENGTH = 5000; // Leave some buffer below the 5,120 limit
        
        if (conversationText.length > MAX_TEXT_LENGTH) {
            // Try to keep the most recent conversation by truncating from the beginning
            conversationText = "..." + conversationText.substring(conversationText.length - MAX_TEXT_LENGTH + 3);
            
            // Find the first complete message after truncation to avoid partial messages
            const firstNewlineIndex = conversationText.indexOf("\n");
            if (firstNewlineIndex > 0 && firstNewlineIndex < 100) {
                conversationText = conversationText.substring(firstNewlineIndex + 1);
            }
        }
        
        // Azure Text Analytics request format
        const requestBody = {
            kind: "SentimentAnalysis",
            parameters: {
                modelVersion: "latest",
                opinionMining: true
            },
            analysisInput: {
                documents: [
                    {
                        id: "1",
                        language: "en",
                        text: conversationText
                    }
                ]
            }
        };

        const requestOptions: RequestInit = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Ocp-Apim-Subscription-Key": apiKey || ""
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(timeout || 10000)
        };

        if (!endpoint) {
            console.error("Azure Text Analytics endpoint is not configured");
            return null;
        }
        
        const apiUrl = `${endpoint}/language/:analyze-text?api-version=2023-04-01`;
        
        const response = await fetch(apiUrl, requestOptions);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Azure Text Analytics API error: ${response.status} ${response.statusText} - ${errorText}`);
            return null;
        }

        const result: AzureTextAnalyticsResponse = await response.json();
        return this.parseAzureTextAnalyticsResponse(result);
    }

    /**
     * Parse response from Azure Text Analytics
     */
    private static parseAzureTextAnalyticsResponse(response: AzureTextAnalyticsResponse): CSATResult | null {
        // Handle both new and legacy response formats
        const documents = response.results?.documents;
        const errors = response.results?.errors;

        // Check for errors or missing data
        if (errors && errors.length > 0) {
            console.error(`Azure Text Analytics error: ${errors[0].error.message}`);
            return null;
        }

        const document = documents?.[0];
        if (!document?.sentiment) {
            console.error("No valid sentiment analysis results returned");
            return null;
        }
        
        const sentiment = document.sentiment === "mixed" ? "neutral" : document.sentiment;
        
        // Calculate CSAT score based on sentiment and confidence
        let csatScore = 3; // Default neutral
        const confidence = Math.max(
            document.confidenceScores.positive,
            document.confidenceScores.negative,
            document.confidenceScores.neutral
        );

        if (sentiment === "positive") {
            // High positive confidence = higher CSAT score
            if (document.confidenceScores.positive > 0.8) csatScore = 5;
            else if (document.confidenceScores.positive > 0.6) csatScore = 4;
            else csatScore = 4;
        } else if (sentiment === "negative") {
            // High negative confidence = lower CSAT score
            if (document.confidenceScores.negative > 0.8) csatScore = 1;
            else if (document.confidenceScores.negative > 0.6) csatScore = 2;
            else csatScore = 2;
        }

        const result = {
            csatScore,
            confidence,
            sentiment: sentiment as "positive" | "negative" | "neutral",
            satisfactionLevel: this.mapSentimentToSatisfaction(sentiment, csatScore),
            reasoning: `Azure Text Analytics: ${sentiment} sentiment detected with ${(confidence * 100).toFixed(1)}% confidence`
        };
        
        return result;
    }
}

// Export interfaces for external use
export type { CSATResult, AzureTextAnalyticsConfig, ChatMessage };