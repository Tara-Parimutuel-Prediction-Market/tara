function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
import { Injectable, Logger } from "@nestjs/common";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { DKAuthService } from "./dk-gateway/dk-auth.service.js";
import { DKSignatureService } from "./dk-gateway/dk-signature.service.js";
import { PaymentConfigService } from "./payment-config.service.js";
export class DKClientService {
    constructor(configService, authService, signatureService){
        this.configService = configService;
        this.authService = authService;
        this.signatureService = signatureService;
        this.logger = new Logger(DKClientService.name);
        this.httpClient = axios.create({
            baseURL: this.configService.baseUrl,
            timeout: 60_000,
            headers: {
                "Content-Type": "application/json"
            }
        });
        // Request interceptor
        this.httpClient.interceptors.request.use((config)=>{
            const startTime = Date.now();
            config.metadata = {
                startTime
            };
            return config;
        }, (error)=>Promise.reject(error));
        // Response interceptor
        this.httpClient.interceptors.response.use((response)=>{
            const duration = Date.now() - (response.config.metadata?.startTime || Date.now());
            this.logger.log(`${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status} (${duration}ms)`);
            return response;
        }, (error)=>{
            const duration = Date.now() - (error.config?.metadata?.startTime || Date.now());
            this.logger.error(`${error.config?.method?.toUpperCase()} ${error.config?.url} - ${error.response?.status || "TIMEOUT"} (${duration}ms)`, error.message);
            return Promise.reject(error);
        });
    }
    async post(endpoint, data, requireSignature = true) {
        // const requestId = "hjskdsewejweiueow"
        const requestId = this.generateRequestId();
        // console.log("Generated Request ID Length:", requestId.length);
        const requestBody = {
            request_id: requestId,
            ...data
        };
        // console.log("Request ID generated:", requestId);
        // console.log("Request Body with ID:", requestBody);
        try {
            const config = {
                headers: {
                    "X-gravitee-api-key": this.configService.apiKey,
                    source_app: this.configService.sourceApp
                }
            };
            if (requireSignature) {
                const token = await this.authService.getValidToken();
                const signatureHeaders = await this.signatureService.generateSignedHeaders(requestBody);
                config.headers = {
                    ...config.headers,
                    Authorization: `Bearer ${token}`,
                    ...signatureHeaders
                };
            }
            //   console.log("\n🔥 === DK GATEWAY HTTP REQUEST DEBUG ===");
            //   console.log("🌐 Full URL:", `${this.configService.baseUrl}${endpoint}`);
            //   console.log("📍 Endpoint:", endpoint);
            //   console.log(
            //     "📤 Request Headers:",
            //     JSON.stringify(config.headers, null, 2),
            //   );
            //   console.log(
            //     "📤 Request Body (Pretty):",
            //     JSON.stringify(requestBody, null, 2),
            //   );
            //   console.log("📤 Request Body (Compact):", JSON.stringify(requestBody));
            //   console.log("🔥 === END REQUEST DEBUG ===\n");
            const response = await this.httpClient.post(endpoint, requestBody, config);
            //   console.log("\n🎯 === DK GATEWAY HTTP RESPONSE DEBUG ===");
            //   console.log("📥 Response Status:", response.status);
            //   console.log(
            //     "📥 Response Headers:",
            //     JSON.stringify(response.headers, null, 2),
            //   );
            //   console.log(
            //     "📥 Response Data (Pretty):",
            //     JSON.stringify(response.data, null, 2),
            //   );
            //   console.log("📥 Response Data (Compact):", JSON.stringify(response.data));
            //   console.log("🎯 === END RESPONSE DEBUG ===\n");
            // TODO: Log to payment_gateway_logs table
            await this.logRequest(endpoint, "POST", requestBody, config.headers, response.data, response.status);
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                // TODO: Log error to payment_gateway_logs table
                await this.logRequest(endpoint, "POST", requestBody, error.config?.headers, error.response?.data, error.response?.status, error.message);
                throw new Error(`DK Gateway Error: ${error.response?.data?.response_description || error.message}`);
            }
            throw error;
        }
    }
    generateRequestId() {
        // Generate a random length between 10 and 36 characters
        const minLength = 10;
        const maxLength = 36;
        const targetLength = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
        // Use UUID without hyphens (32 chars) and timestamp
        const uuid = uuidv4().replace(/-/g, "");
        const timestamp = Date.now().toString();
        const combined = timestamp + uuid;
        // Return substring of the desired length
        return combined.substring(0, targetLength);
    }
    async logRequest(endpoint, method, requestBody, requestHeaders, responseBody, responseStatus, errorMessage) {
        // TODO: Implement logging to payment_gateway_logs table
        this.logger.debug({
            endpoint,
            method,
            requestBody,
            requestHeaders,
            responseBody,
            responseStatus,
            errorMessage
        });
    }
}
DKClientService = _ts_decorate([
    Injectable(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof PaymentConfigService === "undefined" ? Object : PaymentConfigService,
        typeof DKAuthService === "undefined" ? Object : DKAuthService,
        typeof DKSignatureService === "undefined" ? Object : DKSignatureService
    ])
], DKClientService);

//# sourceMappingURL=dk-client.service.js.map