import { DataSource } from "typeorm";
import * as dotenv from "dotenv";
import { User } from "./entities/user.entity";
import { AuthMethod } from "./entities/auth-method.entity";
import { Market } from "./entities/market.entity";
import { Outcome } from "./entities/outcome.entity";
import { Bet } from "./entities/bet.entity";
import { Payment } from "./entities/payment.entity";
import { Transaction } from "./entities/transaction.entity";
import { Settlement } from "./entities/settlement.entity";
import { DKGatewayAuthToken } from "./entities/dk-gateway-auth-token.entity";

dotenv.config();

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 5433,
  username: process.env.DB_USERNAME || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "tara_db",
  synchronize: false,
  logging: true,
  extra: {
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
  },
  entities: [
    User,
    AuthMethod,
    Market,
    Outcome,
    Bet,
    Payment,
    Transaction,
    Settlement,
    DKGatewayAuthToken,
  ],
  migrations: [__dirname + "/migrations/*.ts"],
  subscribers: [],
});
