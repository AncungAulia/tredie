import { Keypair } from "@solana/web3.js";
import { config } from "../config";

function loadSigner(): Keypair {
  try {
    const arr = JSON.parse(config.SIGNER_PRIVATE_KEY) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(arr));
  } catch {
    throw new Error("SIGNER_PRIVATE_KEY must be a JSON array of 64 numbers");
  }
}

export const signer = loadSigner();
