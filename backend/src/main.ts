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
  app.enableCors({
    origin: [
      process.env.FRONTEND_URL || "http://localhost:5173",
      "http://localhost:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5174",
      "https://tara-parimutuel.vercel.app",
      // ngrok tunnels only allowed in development — never in production
      ...(!isProduction ? [/\.ngrok-free\.app$/, /\.ngrok\.io$/] : []),
    ],
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
