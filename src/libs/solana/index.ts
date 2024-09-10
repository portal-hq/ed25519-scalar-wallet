/*
 * Helper functions for interacting with the Solana blockchain.
 */

import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import * as bs58 from "bs58";
import { getPublicKeyAsync, signAsync } from "../ed25119-scalar";

const DEVNET_URL = "https://api.devnet.solana.com";
const MAINNET_URL = "https://api.mainnet-beta.solana.com";

const getNetworkUrl = (useMainnet: boolean) => {
  return useMainnet ? MAINNET_URL : DEVNET_URL;
};

/*
 * Fetches the SOL balance of the given address.
 */
export async function getSolBalance(
  address: string,
  useMainnet: boolean
): Promise<number> {
  const networkUrl = getNetworkUrl(useMainnet);

  return await fetch(networkUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getBalance",
      params: [address],
    }),
  })
    .then((res) => {
      return res.json();
    })
    .then((body) => {
      const lamports = body.result.value;
      const sol = lamports / LAMPORTS_PER_SOL;
      return sol;
    })
    .catch((err) => {
      console.error(err);
      return 0;
    });
}

/*
 * Derives a Solana public key from the given private key.
 */
export async function getPublicKey(privateKey: string): Promise<string> {
  // Convert base58 encoded private key to bytes
  const privateKeyBytes = bs58.default.decode(privateKey);
  if (privateKeyBytes.length !== 32) {
    throw new Error("Invalid private key length");
  }

  // Convert bytes to hex string
  const privateKeyHex = Buffer.from(privateKeyBytes).toString("hex");

  // Get and print Solana public key
  const result = await getPublicKeyAsync(privateKeyHex);
  const solanaAddress = bs58.default.encode(result);

  return solanaAddress;
}

/*
 * Execute transfer of SOL to another owner with the Ed25519 Key.
 */
export async function signAndSendSolTransaction(
  scalarKey: string,
  fromAddress: string,
  toAddress: string,
  amount: number,
  useMainnet: boolean
): Promise<string> {
  const network = getNetworkUrl(useMainnet);

  // Create public keys from address strings
  const fromPublicKey = new PublicKey(fromAddress);
  const toPublicKey = new PublicKey(toAddress);

  // prep the private key hex
  const privateKeyHex = Buffer.from(bs58.default.decode(scalarKey)).toString(
    "hex"
  );

  const connection = new Connection(network);
  const { blockhash } = await connection.getLatestBlockhash("finalized");
  let tx = new Transaction({
    recentBlockhash: blockhash,
    feePayer: fromPublicKey,
  }).add(
    SystemProgram.transfer({
      fromPubkey: fromPublicKey,
      toPubkey: toPublicKey,
      lamports: LAMPORTS_PER_SOL * amount,
    })
  );

  // Serialize the transaction to a Buffer
  const serializedMessage = tx.serializeMessage();

  // Convert the serialized transaction to a hex string
  const serializedHex = Buffer.from(serializedMessage).toString("hex");
  const transactionSignature = await signAsync(serializedHex, privateKeyHex);

  // Convert uint8 array to Buffer
  const signatureBuffer = Buffer.from(transactionSignature);
  console.log("Unsigned transaction: ", tx);
  tx.addSignature(fromPublicKey, signatureBuffer);
  console.log("Signed transaction: ", tx);
  if (!tx.verifySignatures()) {
    throw new Error("Signature verification failed");
  }

  const rawTransaction = tx.serialize();
  const hash = await connection.sendRawTransaction(rawTransaction);

  return hash;
}
