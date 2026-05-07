import { buildInitFactoryTx, sendAndConfirm } from "../solana/instructions";
import { signer } from "../solana/signer";
import { factoryPda } from "../solana/pda";
import { connection } from "../solana/connection";

async function main() {
  const [factory] = factoryPda();
  const existing = await connection.getAccountInfo(factory);
  if (existing) {
    console.log(`Factory already initialized at ${factory.toBase58()}`);
    return;
  }

  const tx = await buildInitFactoryTx({
    feeRecipient: signer.publicKey, // backend signer = fee recipient (sementara)
    feeBasisPoints: 100, // 1% protocol fee
  });
  const sig = await sendAndConfirm(tx);
  console.log(`Factory initialized: ${factory.toBase58()}`);
  console.log(`Signature: ${sig}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
