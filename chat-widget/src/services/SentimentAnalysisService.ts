import { LogLevel, TelemetryEvent } from "../common/telemetry/TelemetryConstants";
import { TelemetryHelper } from "../common/telemetry/TelemetryHelper";
import { FacadeChatSDK } from "../common/facades/FacadeChatSDK";
import { Constants } from "../common/Constants";

// Azure AI Language Text SDK
import { TextAnalysisClient } from "@azure/ai-language-text";
import type { SentimentAnalysisSuccessResult } from "@azure/ai-language-text";
import { DefaultAzureCredential } from "@azure/identity";

interface SentimentAnalysisConfig {
    endpoint?: string;
    apiKey?: string;
    timeout?: number;
    enabled?: boolean;
    useDefaultCredential?: boolean;
}

interface CSATResult {
    csatScore: number;
    confidence: number;
    sentiment: "positive" | "negative" | "neutral";
    satisfactionLevel: string;
    reasoning?: string;
    surveyResponseIncluded?: boolean;
}

interface CopilotSurveyResponse {
    response: string;
    timestamp: string;
    conversationId?: string;
    userId?: string;
    botId?: string;
    confidence?: number;
}

interface DirectLineActivity {
    type?: string;
    text?: string;
    textFormat?: string;
    channelData?: {
        clientActivityID?: string;
        cci_trace_id?: string;
    };
    cci_bot_id?: string;
    from?: {
        id?: string;
    };
    localTimestamp?: string;
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

/**
 * Sentiment Analysis Service - Using Azure AI Language Text SDK
 */
export class SentimentAnalysisService {
    private static readonly DEFAULT_CONFIG: SentimentAnalysisConfig = {
        // Azure Cognitive Services endpoint and key
        endpoint: "https://chat-sentiment-analytics.cognitiveservices.azure.com",
        apiKey: "<API_KEY>",
        timeout: 10000,
        enabled: true,
        useDefaultCredential: false
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
     * Analyzes customer sentiment from chat transcript to generate CSAT scores and satisfaction levels
     * @param facadeChatSDK - SDK instance to fetch live chat transcript from the session
     * @param config - Optional configuration for Azure Text Analytics endpoint, credentials, and settings
     * @returns Promise<CSATResult | null> - CSAT analysis result with score (1-5), confidence, sentiment, and satisfaction level
     */
    static async analyzeSentiments(
        facadeChatSDK: FacadeChatSDK, 
        config?: SentimentAnalysisConfig
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

            // Call sentiment analysis
            const result = await this.callSentimentAnalysis(chatTranscript, effectiveConfig);
            
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
                Description: `Customer sentiment CSAT analysis completed successfully. CSAT Score: ${result.csatScore}, Confidence: ${result.confidence.toFixed(3)}, Sentiment: ${result.sentiment}, Satisfaction Level: ${result.satisfactionLevel}`,
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
     * Extract chat messages from transcript
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
        // Check customer messages
        if (message.tags?.includes("FromCustomer") || message.from?.application?.displayName === "Customer") {
            return "customer";
        }
        // Check agent messages
        if (message.tags?.includes("public")) {
            return "agent";
        }
        return "bot";
    }

    /**
     * Create sentiment analysis client
     */
    private static createSentimentClient(config: SentimentAnalysisConfig): TextAnalysisClient | null {
        try {
            if (!config.endpoint) {
                console.error("Azure Text Analytics endpoint is not configured");
                return null;
            }

            // Support both API key and managed identity authentication
            return new TextAnalysisClient(config.endpoint, new DefaultAzureCredential());
            // if (config.useDefaultCredential) {
            //     // Use managed identity
            //     return new TextAnalysisClient(config.endpoint, new DefaultAzureCredential());
            // } else if (config.apiKey) {
            //     // Use API key authentication
            //     return new TextAnalysisClient(config.endpoint, new AzureKeyCredential(config.apiKey));
            // } else {
            //     console.error("Azure Text Analytics authentication not configured - need either apiKey or useDefaultCredential");
            //     return null;
            // }
        } catch (error) {
            console.error("Failed to create Azure Text Analytics client:", error);
            return null;
        }
    }

    /**
     * Call sentiment analysis API
     */
    private static async callSentimentAnalysis(
        chatTranscript: ChatMessage[], 
        config: SentimentAnalysisConfig
    ): Promise<CSATResult | null> {
        try {
            // Create client using azure AI SDK
            const client = this.createSentimentClient(config);
            if (!client) {
                return null;
            }

            // Build conversation text ensuring latest messages are always included
            const MAX_TEXT_LENGTH = 5000;
            let conversationText = "";
            
            // Build conversation text starting with the latest messages
            for (let i = chatTranscript.length - 1; i >= 0; i--) {
                const message = chatTranscript[i];
                const messageText = `[${message.sender}]: ${message.content}\n`;
                
                // Always include at least the latest message, even if it exceeds the limit
                if (i === chatTranscript.length - 1 || conversationText.length + messageText.length <= MAX_TEXT_LENGTH) {
                    conversationText = messageText + conversationText;
                } else {
                    break;
                }
            }

            // Call Azure Text Analytics for sentiment analysis
            const results = await client.analyze("SentimentAnalysis", [{ text: conversationText, id: "1" }]);
            
            // Parse the result
            const result = results[0];
            if (!result || result.error) {
                console.error("Azure Text Analytics API error:", result?.error);
                return null;
            }

            return this.parseAzureSDKResponse(result);

        } catch (error) {
            console.error("Azure Text Analytics SDK error:", error);
            return null;
        }
    }

    /**
     * Parse response from Azure Text Analytics SDK
     */
    private static parseAzureSDKResponse(result: SentimentAnalysisSuccessResult): CSATResult | null {
        try {
            if (!result?.sentiment) {
                console.error("No valid sentiment analysis results returned");
                return null;
            }
            
            const sentiment = result.sentiment === "mixed" ? "neutral" : result.sentiment;
            
            // Calculate CSAT score based on sentiment and confidence
            let csatScore = 3; // Default neutral
            const confidence = Math.max(
                result.confidenceScores.positive,
                result.confidenceScores.negative,
                result.confidenceScores.neutral
            );

            if (sentiment === "positive") {
                // High positive confidence = higher CSAT score
                if (result.confidenceScores.positive > 0.8) csatScore = 5;
                else if (result.confidenceScores.positive > 0.6) csatScore = 4;
                else csatScore = 4;
            } else if (sentiment === "negative") {
                // High negative confidence = lower CSAT score
                if (result.confidenceScores.negative > 0.8) csatScore = 1;
                else if (result.confidenceScores.negative > 0.6) csatScore = 2;
                else csatScore = 2;
            }

            const csatResult = {
                csatScore,
                confidence,
                sentiment: sentiment as "positive" | "negative" | "neutral",
                satisfactionLevel: this.mapSentimentToSatisfaction(sentiment, csatScore),
                reasoning: `Azure Text Analytics: ${sentiment} sentiment detected with ${(confidence * 100).toFixed(1)}% confidence`,
            };
            
            return csatResult;

        } catch (error) {
            console.error("Error parsing Azure Text Analytics response:", error);
            return null;
        }
    }

    /**
     * Helper function to identify Copilot Studio survey responses from DirectLine activities
     * @param activity - DirectLine activity object
     * @returns boolean - true if the activity is a survey response
     */
    static isCopilotSurveyResponse(activity: DirectLineActivity): boolean {
        return !!(
            activity?.type === "message" &&
            activity?.channelData?.clientActivityID &&
            activity?.cci_bot_id &&
            activity?.text &&
            /^[1-5]$/.test(activity.text) && // Assuming 1-5 scale
            activity?.textFormat === "plain"
        );
    }

    /**
     * Extract survey response data from DirectLine activity
     * @param activity - DirectLine activity object
     * @returns CopilotSurveyResponse | null
     */
    static extractSurveyResponse(activity: DirectLineActivity): CopilotSurveyResponse | null {
        if (!this.isCopilotSurveyResponse(activity)) {
            return null;
        }

        return {
            response: activity.text || "",
            timestamp: activity.localTimestamp || new Date().toISOString(),
            conversationId: activity.channelData?.cci_trace_id,
            userId: activity.from?.id,
            botId: activity.cci_bot_id,
            confidence: 95 // High confidence for explicit feedback
        };
    }

    /**
     * Analyzes sentiment with optional Copilot Studio survey response integration
     * @param facadeChatSDK - SDK instance to fetch live chat transcript
     * @param copilotSurveyResponse - Optional survey response from Copilot Studio
     * @param config - Optional configuration for Azure Text Analytics
     * @returns Promise<CSATResult | null> - Enhanced CSAT analysis combining AI and survey data
     */
    static async analyzeSentimentWithSurvey(
        facadeChatSDK: FacadeChatSDK,
        copilotSurveyResponse?: CopilotSurveyResponse,
        config?: SentimentAnalysisConfig
    ): Promise<CSATResult | null> {
        try {
            // Get AI sentiment analysis
            const sentimentResult = await this.analyzeSentiments(facadeChatSDK, config);
            
            if (copilotSurveyResponse && sentimentResult) {
                // Combine AI sentiment with explicit survey response
                const combinedResult = this.combineSentimentAndSurvey(sentimentResult, copilotSurveyResponse);
                
                // Log the combined analysis
                TelemetryHelper.logActionEvent(LogLevel.INFO, {
                    Event: TelemetryEvent.CSATAnalysisCompleted,
                    Description: "Combined CSAT analysis completed with Copilot Studio survey response",
                    CustomProperties: {
                        aiCsatScore: sentimentResult.csatScore.toString(),
                        surveyCsatScore: copilotSurveyResponse.response,
                        combinedCsatScore: combinedResult.csatScore.toString(),
                        confidence: combinedResult.confidence.toFixed(3),
                        sentiment: combinedResult.sentiment,
                        satisfactionLevel: combinedResult.satisfactionLevel,
                        surveyIncluded: "true"
                    }
                });
                
                return combinedResult;
            }
            
            // Log survey response if available but no sentiment result
            if (copilotSurveyResponse && !sentimentResult) {
                TelemetryHelper.logActionEvent(LogLevel.INFO, {
                    Event: TelemetryEvent.CSATAnalysisCompleted,
                    Description: "CSAT analysis completed using only Copilot Studio survey response",
                    CustomProperties: {
                        surveyCsatScore: copilotSurveyResponse.response,
                        confidence: "95.0",
                        surveyIncluded: "true",
                        aiAnalysisFailed: "true"
                    }
                });
                
                return this.createCSATFromSurvey(copilotSurveyResponse);
            }
            
            return sentimentResult;

        } catch (error) {
            TelemetryHelper.logActionEvent(LogLevel.ERROR, {
                Event: TelemetryEvent.CSATAnalysisFailed,
                Description: "Enhanced CSAT analysis with survey response failed",
                CustomProperties: {
                    errorMessage: error instanceof Error ? error.message : "Unknown error",
                    errorType: error instanceof Error ? error.constructor.name : "UnknownError",
                    hasSurveyResponse: copilotSurveyResponse ? "true" : "false"
                }
            });
            
            return null;
        }
    }

    /**
     * Combine AI sentiment analysis with explicit survey response
     * @param sentimentResult - AI sentiment analysis result
     * @param surveyResponse - Copilot Studio survey response
     * @returns CSATResult - Combined result
     */
    private static combineSentimentAndSurvey(
        sentimentResult: CSATResult, 
        surveyResponse: CopilotSurveyResponse
    ): CSATResult {
        const surveyScore = parseInt(surveyResponse.response);
        
        // Validate survey score
        if (isNaN(surveyScore) || surveyScore < 1 || surveyScore > 5) {
            // Return original sentiment result if survey score is invalid
            return sentimentResult;
        }
        
        // Weight: 70% survey response (explicit), 30% AI sentiment (implicit)
        const combinedScore = Math.round(
            (surveyScore * 0.7) + (sentimentResult.csatScore * 0.3)
        );
        
        // Ensure score is within valid range
        const finalScore = Math.max(1, Math.min(5, combinedScore));
        
        return {
            csatScore: finalScore,
            confidence: Math.max(sentimentResult.confidence, 0.95), // Higher confidence with explicit feedback
            sentiment: this.mapScoreToSentiment(finalScore),
            satisfactionLevel: this.mapSentimentToSatisfaction("", finalScore),
            reasoning: `Combined analysis: Survey response (${surveyScore}) weighted 70%, AI sentiment (${sentimentResult.csatScore}) weighted 30%`,
            surveyResponseIncluded: true
        };
    }

    /**
     * Create CSAT result from survey response only
     * @param surveyResponse - Copilot Studio survey response
     * @returns CSATResult - CSAT result based only on survey
     */
    private static createCSATFromSurvey(surveyResponse: CopilotSurveyResponse): CSATResult {
        const surveyScore = parseInt(surveyResponse.response);
        
        // Validate survey score
        if (isNaN(surveyScore) || surveyScore < 1 || surveyScore > 5) {
            // Return neutral result if survey score is invalid
            return {
                csatScore: 3,
                confidence: 0.5,
                sentiment: "neutral",
                satisfactionLevel: "Neutral",
                reasoning: "Invalid survey response, defaulting to neutral",
                surveyResponseIncluded: true
            };
        }
        
        return {
            csatScore: surveyScore,
            confidence: 0.95, // High confidence for explicit feedback
            sentiment: this.mapScoreToSentiment(surveyScore),
            satisfactionLevel: this.mapSentimentToSatisfaction("", surveyScore),
            reasoning: `Based on Copilot Studio survey response: ${surveyScore}/5`,
            surveyResponseIncluded: true
        };
    }

    /**
     * Map numeric score to sentiment
     * @param score - CSAT score (1-5)
     * @returns sentiment string
     */
    private static mapScoreToSentiment(score: number): "positive" | "negative" | "neutral" {
        if (score >= 4) return "positive";
        if (score <= 2) return "negative";
        return "neutral";
    }

    /**
     * Process and log Copilot Studio survey response for telemetry
     * @param surveyResponse - Survey response data
     */
    static logSurveyResponse(surveyResponse: CopilotSurveyResponse): void {
        // TelemetryHelper.logActionEvent(LogLevel.INFO, {
        //     Event: TelemetryEvent.CustomContextReceived, // Reusing existing event or create new one
        //     Description: "Copilot Studio survey response captured",
        //     CustomProperties: {
        //         surveyResponse: surveyResponse.response,
        //         conversationId: surveyResponse.conversationId || "unknown",
        //         userId: surveyResponse.userId || "unknown",
        //         botId: surveyResponse.botId || "unknown",
        //         timestamp: surveyResponse.timestamp,
        //         confidence: surveyResponse.confidence?.toString() || "95"
        //     }
        // });
        console.log("Survey Response Logged:", surveyResponse);
    }
}

// Export interfaces for external use
export type { CSATResult, SentimentAnalysisConfig, ChatMessage, CopilotSurveyResponse, DirectLineActivity };