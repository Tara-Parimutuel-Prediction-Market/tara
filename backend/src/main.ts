import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS
  app.enableCors({
    origin: [
      process.env.FRONTEND_URL || "http://localhost:5173",
      "http://localhost:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5174",
      "https://tara-parimutuel.vercel.app",
      /\.ngrok-free\.app$/, // Allow all ngrok URLs
      /\.ngrok\.io$/, // Allow ngrok.io URLs too
    ],
    credentials: true,
  });

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
