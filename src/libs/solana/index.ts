/*
 * Helper functions for interacting with the Solana blockchain.
 */

import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SendTransactionError,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import * as bs58 from "bs58";
import { getPublicKeyAsync, signAsync } from "../ed25119-scalar";
import {
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";

const DEVNET_URL =
  process.env.REACT_APP_SOLANA_DEVNET_RPC_URL ||
  "https://api.devnet.solana.com";
const MAINNET_URL =
  process.env.REACT_APP_SOLANA_MAINNET_RPC_URL ||
  "https://api.mainnet-beta.solana.com";

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

  // Sign the serialized transaction
  const transactionSignature = await signAsync(serializedHex, privateKeyHex);

  // Add the signature to the transaction
  const signatureBuffer = Buffer.from(transactionSignature);
  tx.addSignature(fromPublicKey, signatureBuffer);
  console.log("Signed transaction: ", tx);

  // Verify the transaction
  if (!tx.verifySignatures()) {
    throw new Error("Signature verification failed");
  }

  const rawTransaction = tx.serialize();
  const hash = await connection.sendRawTransaction(rawTransaction);

  return hash;
}

/*
 * Execute transfer of an SPL-22 token to another owner.
 */
export async function signAndSendSPLTransferTransaction(
  scalarKey: string,
  sender: string,
  recipient: string,
  amount: number,
  tokenAddress: string,
  useMainnet: boolean
): Promise<string | null> {
  const network = getNetworkUrl(useMainnet);

  // prep the private key hex
  const privateKeyHex = Buffer.from(bs58.default.decode(scalarKey)).toString(
    "hex"
  );

  // Create connection to the network
  const connection = new Connection(network);

  const tokenPublicKey = new PublicKey(tokenAddress);
  const PYUSD_DECIMALS = 6;

  // Sender & receiver PublicKeys from address strings
  const senderPublicKey = new PublicKey(sender);
  const recipientPublicKey = new PublicKey(recipient);

  // Instructions array to hold the transaction instructions
  const instructions = [];

  // Each SPL token has an associated token account for each owner
  // Check if the sender address has an associated token account for PYUSD
  const senderTokenAddress = await getAssociatedTokenAddress(
    tokenPublicKey,
    senderPublicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  const senderAccountInfo = await connection.getAccountInfo(senderTokenAddress);
  if (!senderAccountInfo) {
    // If there is no senderAccountInfo then the sender does not have any
    // PYUSD to send.
    console.error(
      `Sender ${sender} does not have a token account for PYUSD (${tokenPublicKey.toString()}). They likely do not any PYUSD to send. Get some PYUSD before trying to send.`
    );
    return null;
  }

  // Check if the recipient address has an associated token account for PYUSD
  const receiverTokenAddress = await getAssociatedTokenAddress(
    tokenPublicKey,
    recipientPublicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  const receiverAccountInfo = await connection.getAccountInfo(
    receiverTokenAddress
  );
  if (!receiverAccountInfo) {
    // If there is no receiverAccountInfo then we need to create and pay for
    // a token account for the recipient before we can transfer PYUSD to them.
    console.log(
      `Creating new token account at ${receiverTokenAddress} for ${recipient} on ${tokenPublicKey.toString()} paid for by ${sender}`
    );
    const createTokenAccountIx = createAssociatedTokenAccountInstruction(
      senderPublicKey, // Payer
      receiverTokenAddress, // Associated token account address
      recipientPublicKey, // Owner of the associated token account
      tokenPublicKey,
      TOKEN_2022_PROGRAM_ID
    );

    // Add the create token account instruction to the instructions array
    // so we can execute all instructions in one transaction.
    instructions.push(createTokenAccountIx);
  }

  // Fetch recent blockhash
  const blockhash = await connection.getLatestBlockhash("finalized");

  // Create the transfer instruction to send PYUSD from sender
  // to recipient
  const transferInstruction = createTransferCheckedInstruction(
    senderTokenAddress, // sender token account
    tokenPublicKey, // mint PublicKey
    receiverTokenAddress, // receiver token account
    senderPublicKey, // owner PublicKey
    amount * Math.pow(10, PYUSD_DECIMALS), // amount in minimum units
    PYUSD_DECIMALS, // decimals
    [], // signers - empty because we're going to be signing when we submit
    TOKEN_2022_PROGRAM_ID // programId
  );

  // Add the create token account instruction to the instructions array
  // so we can execute all instructions in one transaction.
  instructions.push(transferInstruction);

  // Create the transaction message with the payer and latest blockhash
  const message = new TransactionMessage({
    payerKey: senderPublicKey,
    recentBlockhash: blockhash.blockhash,
    instructions,
  });

  // Create the versioned transaction with the message.
  // CompileToV0Message will convert the message to a versioned message
  // https://solana.com/docs/advanced/versions#notes
  const transaction = new VersionedTransaction(message.compileToV0Message());
  console.log("Unsigned versioned transaction: ", transaction);

  // Serialized the transaction and properly encode it to be
  // signed by Portal
  const serializedTransaction = transaction.message.serialize();

  // Convert the serialized transaction to a hex string
  const serializedHex = Buffer.from(serializedTransaction).toString("hex");

  // Sign the serialized transaction
  const transactionSignature = await signAsync(serializedHex, privateKeyHex);

  // Add the signature to the transaction
  const signatureBuffer = Buffer.from(transactionSignature);
  transaction.addSignature(senderPublicKey, signatureBuffer);

  const rawTransaction = transaction.serialize();

  try {
    const hash = await connection.sendRawTransaction(rawTransaction);
    return hash;
  } catch (e) {
    console.log(e);
    (e as SendTransactionError).getLogs(connection);
  }
  return null;
}
