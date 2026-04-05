import "reflect-metadata";
import * as dotenv from "dotenv";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";

// Load environment variables
dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS
  const isProduction = process.env.NODE_ENV === "production";
  const allowedOrigins: (string | RegExp)[] = [
    "https://tara-parimutuel.vercel.app",
  ];
  if (!isProduction) {
    allowedOrigins.push(
      "http://localhost:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5174",
    );
    // Allow an explicit ngrok URL set in .env (DEV_NGROK_URL=https://xxxx.ngrok-free.app)
    // — no wildcard regex; each tunnel URL must be explicitly opted in
    const devNgrok = process.env.DEV_NGROK_URL;
    if (devNgrok) allowedOrigins.push(devNgrok);
  }
  if (process.env.FRONTEND_URL) {
    // Validate FRONTEND_URL is a proper https origin before trusting it
    try {
      const parsed = new URL(process.env.FRONTEND_URL);
      if (parsed.protocol === "https:") allowedOrigins.push(parsed.origin);
    } catch {
      console.warn("FRONTEND_URL is not a valid URL — skipping CORS entry");
    }
  }
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // Global API prefix — all routes are /api/*
  app.setGlobalPrefix("api");

  // Global validation
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Swagger docs
  const config = new DocumentBuilder()
    .setTitle("Tara Parimutuel API")
    .setDescription("Parimutuel betting engine for Telegram Mini App")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("docs", app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Tara backend running on http://localhost:${port}`);
  console.log(`📖 Swagger docs: http://localhost:${port}/docs`);

}
bootstrap();
