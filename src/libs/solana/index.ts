/*
 * Helper functions for interacting with the Solana blockchain.
 */

import {
  Connection,
  LAMPORTS_PER_SOL,
  ParsedAccountData,
  PublicKey,
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
  getTokenMetadata,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
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
 * Fetch SPL token info
 */
export async function getSPLTokenInfo(
  tokenAddress: string,
  useMainnet: boolean
): Promise<any> {
  const network = getNetworkUrl(useMainnet);
  const connection = new Connection(network);

  const tokenPublicKey = new PublicKey(tokenAddress);
  const accountInfo = await connection.getParsedAccountInfo(tokenPublicKey);

  const is2022Program =
    (accountInfo?.value?.data as ParsedAccountData).program ===
    "spl-token-2022";

  let name = "";
  let symbol = "";

  if (is2022Program) {
    const metadata = await getTokenMetadata(
      connection,
      tokenPublicKey,
      "finalized",
      TOKEN_2022_PROGRAM_ID
    );
    name = metadata?.name || "";
    symbol = metadata?.symbol || "";
  } else {
    console.log("Could not fetch token metadata for non-2022 program");
  }

  return { name, symbol };
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

  // Sender & receiver PublicKeys from address strings
  const senderPublicKey = new PublicKey(sender);
  const recipientPublicKey = new PublicKey(recipient);

  // Instructions array to hold the transaction instructions
  const instructions = [];

  // Get token account & mint info
  const tokenInfo = await connection.getParsedAccountInfo(tokenPublicKey);

  if (!tokenInfo) {
    throw Error(
      `No token account found for SPL token with address (${tokenPublicKey.toString()})
       on Solana ${
         useMainnet ? "mainnet" : "testnet"
       }. Check the SPL address is correct and that the SPL token exists before trying to send.`
    );
  }

  const programData = tokenInfo.value?.data as ParsedAccountData;

  if (!programData) {
    throw Error(
      `No program data found for SPL token with address (${tokenPublicKey.toString()})
       on Solana ${
         useMainnet ? "mainnet" : "testnet"
       }. Check the SPL address is correct and that the SPL token exists before trying to send.`
    );
  }

  // set the token program Id based on the token program
  const tokenProgramId =
    programData.program === "spl-token-2022"
      ? TOKEN_2022_PROGRAM_ID
      : TOKEN_PROGRAM_ID;
  const tokenDecimals = programData.parsed.info.decimals;

  // Each SPL token has an associated token account for each owner
  // Check if the sender address has an associated token account for the SPL token
  const senderTokenAddress = await getAssociatedTokenAddress(
    tokenPublicKey,
    senderPublicKey,
    false,
    tokenProgramId
  );

  const senderAccountInfo = await connection.getAccountInfo(senderTokenAddress);
  if (!senderAccountInfo) {
    // If there is no senderAccountInfo then the sender does not have any
    // the SPL token to send.
    throw Error(
      `Sender ${sender} does not have a token account for SPL token with address (${tokenPublicKey.toString()})
       on Solana ${
         useMainnet ? "mainnet" : "testnet"
       }. Check the SPL address is correct, that the current mainnet
       toggle is correct, and that the sender has the specified SPL token before trying to send.`
    );
  }

  // Check if the recipient address has an associated token account for the SPL token
  const receiverTokenAddress = await getAssociatedTokenAddress(
    tokenPublicKey,
    recipientPublicKey,
    false,
    tokenProgramId
  );

  const receiverAccountInfo = await connection.getAccountInfo(
    receiverTokenAddress
  );
  if (!receiverAccountInfo) {
    // If there is no receiverAccountInfo then we need to create and pay for
    // a token account for the recipient before we can transfer the SPL token to them.
    console.log(
      `Creating new token account at ${receiverTokenAddress} for ${recipient} on ${tokenPublicKey.toString()} paid for by ${sender}`
    );
    const createTokenAccountIx = createAssociatedTokenAccountInstruction(
      senderPublicKey, // Payer
      receiverTokenAddress, // Associated token account address
      recipientPublicKey, // Owner of the associated token account
      tokenPublicKey,
      tokenProgramId
    );

    // Add the create token account instruction to the instructions array
    // so we can execute all instructions in one transaction.
    instructions.push(createTokenAccountIx);
  }

  // Fetch recent blockhash
  const blockhash = await connection.getLatestBlockhash("finalized");

  // Create the transfer instruction to send the SPL token from the sender
  // to recipient
  const transferInstruction = createTransferCheckedInstruction(
    senderTokenAddress, // sender token account
    tokenPublicKey, // mint PublicKey
    receiverTokenAddress, // receiver token account
    senderPublicKey, // owner PublicKey
    amount * Math.pow(10, tokenDecimals), // amount in minimum units
    tokenDecimals, // decimals
    [], // signers - empty because we're going to be signing when we submit
    tokenProgramId // programId
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

  // Send the transaction to the network
  const hash = await connection.sendRawTransaction(rawTransaction);
  return hash;
}
