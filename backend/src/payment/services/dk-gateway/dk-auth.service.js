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
import { PaymentConfigService } from "../payment-config.service.js";
export class DKAuthService {
    constructor(configService){
        this.configService = configService;
        this.logger = new Logger(DKAuthService.name);
        this.tokenCache = null;
        this.privateKeyCache = null;
        this.httpClient = axios.create({
            baseURL: this.configService.baseUrl,
            timeout: 30_000,
            headers: {
                "Content-Type": "application/json",
                "X-gravitee-api-key": this.configService.apiKey
            }
        });
    }
    async getValidToken() {
        if (this.tokenCache && !this.isTokenExpiringSoon()) {
            return this.tokenCache.accessToken;
        }
        await this.refreshToken();
        // console.log(
        //   "Token refreshed in getValidToken",
        //   this.tokenCache!.accessToken,
        // );
        return this.tokenCache.accessToken;
    }
    async getPrivateKey() {
        if (this.privateKeyCache) {
            return this.privateKeyCache;
        }
        await this.fetchPrivateKey();
        // console.log(
        //   "Private key fetched in getPrivateKey",
        //   this.privateKeyCache!.slice(0, 10) + "...",
        // );
        return this.privateKeyCache;
    }
    async refreshToken() {
        try {
            //   this.logger.log("Fetching new authentication token...");
            //   console.log();
            const config = this.configService.getConfig();
            // Prepare form-urlencoded data
            const params = new URLSearchParams();
            params.append("username", config.username);
            params.append("password", config.password);
            params.append("client_id", config.clientId);
            params.append("client_secret", config.clientSecret);
            params.append("grant_type", "password");
            params.append("scopes", "keys:read");
            params.append("source_app", config.sourceApp);
            params.append("request_id", this.generateRequestId());
            const response = await this.httpClient.post("/v1/auth/token", params.toString(), {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            });
            if (response.data.response_code !== "0000" || !response.data.response_data) {
                throw new Error(`Token fetch failed: ${response.data.response_description}`);
            }
            const tokenData = response.data.response_data;
            const expiresAt = new Date();
            expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);
            this.tokenCache = {
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token,
                tokenType: tokenData.token_type,
                expiresIn: tokenData.expires_in,
                expiresAt
            };
            this.logger.log("Authentication token fetched successfully");
            // ✅ LOGGING THE ACCESS TOKEN HERE
            this.logger.debug(`New Access Token received: ${this.tokenCache.accessToken.slice(0, 10)}... (Expires: ${this.tokenCache.expiresAt.toISOString()})`);
        } catch (error) {
            this.logger.error("Failed to fetch authentication token", error);
            throw error;
        }
    }
    async fetchPrivateKey() {
        try {
            this.logger.log("Fetching RSA private key...");
            const token = await this.getValidToken();
            const response = await this.httpClient.post("/v1/sign/key", {
                request_id: this.generateRequestId(),
                source_app: this.configService.sourceApp
            }, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            //   console.log(
            //     "Private key response data:",
            //     typeof response.data === "string"
            //       ? response.data.slice(0, 30) + "..."
            //       : JSON.stringify(response.data),
            //   );
            // Success response is plain text RSA key (can be either "BEGIN PRIVATE KEY" or "BEGIN RSA PRIVATE KEY")
            if (typeof response.data === "string" && response.data.includes("BEGIN PRIVATE KEY") && response.data.includes("END PRIVATE KEY")) {
                this.privateKeyCache = response.data;
                this.logger.log("RSA private key fetched successfully");
            } else if (typeof response.data === "object" && response.data !== null) {
                // Error responses come as JSON objects
                const errorData = response.data;
                const errorMessage = errorData.response_detail || errorData.response_description || "Unknown error";
                throw new Error(`Failed to fetch private key: ${errorMessage} (Code: ${errorData.response_code})`);
            } else {
                throw new Error("Invalid RSA key response format");
            }
        } catch (error) {
            this.logger.error("Failed to fetch RSA private key", error);
            throw error;
        }
    }
    isTokenExpiringSoon() {
        if (!this.tokenCache) {
            return true;
        }
        // Refresh if token expires in less than 5 minutes
        const fiveMinutesFromNow = new Date();
        fiveMinutesFromNow.setMinutes(fiveMinutesFromNow.getMinutes() + 5);
        return this.tokenCache.expiresAt <= fiveMinutesFromNow;
    }
    generateRequestId() {
        return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    }
    // For testing/admin purposes
    clearCache() {
        this.tokenCache = null;
        this.privateKeyCache = null;
        this.logger.log("Token and key cache cleared");
    }
}
DKAuthService = _ts_decorate([
    Injectable(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof PaymentConfigService === "undefined" ? Object : PaymentConfigService
    ])
], DKAuthService);

//# sourceMappingURL=dk-auth.service.js.map