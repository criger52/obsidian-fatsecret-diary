import CryptoJS from "crypto-js";

function percentEncode(str: string): string {
    return encodeURIComponent(str)
        .replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

export class OAuthRequest {
    requestParams: Record<string, string>;

    constructor(
        httpMethod: string,
        url: string,
        requestParams: Record<string, string>,
        consumerKey: string,
        consumerSecret: string,
        oauthSecret: string = ""
    ) {
        this.requestParams = { ...requestParams };
        this.requestParams["oauth_consumer_key"] = consumerKey;
        this.requestParams["oauth_signature_method"] = "HMAC-SHA1";
        this.requestParams["oauth_timestamp"] = Math.floor(Date.now() / 1000).toString();
        this.requestParams["oauth_nonce"] = this.generateNonce();
        this.requestParams["oauth_version"] = "1.0";

        this.requestParams["oauth_signature"] = this.calcSignature(
            httpMethod,
            url,
            this.requestParams,
            consumerSecret,
            oauthSecret
        );
    }

    private generateNonce(): string {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    }

    private calcSignature(
        httpMethod: string,
        url: string,
        params: Record<string, string>,
        consumerSecret: string,
        oauthSecret: string
    ): string {
        const normalized = Object.entries(params)
            .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
            .sort()
            .join("&");

        const signatureBase = [
            httpMethod.toUpperCase(),
            percentEncode(url),
            percentEncode(normalized),
        ].join("&");

        const signatureKey = `${percentEncode(consumerSecret)}&${percentEncode(oauthSecret)}`;

        const hash = CryptoJS.HmacSHA1(signatureBase, signatureKey);
        return CryptoJS.enc.Base64.stringify(hash);
    }
}

export class OAuthHelper {
    static buildRequest(
        httpMethod: string,
        url: string,
        consumerKey: string,
        consumerSecret: string,
        oauthSecret: string = "",
        requestParams: Record<string, string> = {}
    ): OAuthRequest {
        return new OAuthRequest(
            httpMethod,
            url,
            requestParams,
            consumerKey,
            consumerSecret,
            oauthSecret
        );
    }
}