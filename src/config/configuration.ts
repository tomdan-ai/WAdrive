export default () => ({
    port: parseInt(process.env.PORT ?? '3000', 10),
    databaseUrl: process.env.DATABASE_URL,
    twilio: {
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER,
    },
    b2: {
        endpoint: process.env.B2_ENDPOINT,
        bucketName: process.env.B2_BUCKET_NAME,
        keyId: process.env.B2_KEY_ID,
        applicationKey: process.env.B2_APPLICATION_KEY,
        region: process.env.B2_REGION ?? 'us-east-005',
    },
    storage: {
        freeTierBytes: parseInt(process.env.FREE_TIER_BYTES ?? '524288000', 10),
        signedUrlExpirySeconds: parseInt(
            process.env.SIGNED_URL_EXPIRY_SECONDS ?? '3600',
            10,
        ),
        rateLimitPerHour: parseInt(process.env.RATE_LIMIT_PER_HOUR ?? '20', 10),
    },
});
