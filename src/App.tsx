import { useState } from "react";
import "./App.css";
import {
  getPublicKey,
  getSolBalance,
  signAndSendSolTransaction,
  signAndSendSPLTransferTransaction,
} from "./libs/solana";
import {
  alpha,
  Box,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { signAsync } from "./libs/ed25119-scalar";
import * as bs58 from "bs58";

function App() {
  const [scalarKey, setScalarKey] = useState<string>(
    "7QouaVEmauRJgEhLXEaj3Et8VZXfuYzHYLw35FDZVFau"
  );
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [recipient, setRecipient] = useState<string>("");
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [txhash, setTxhash] = useState<string | null>(null);
  const [splRecipient, setSplRecipient] = useState<string>("");
  const [splTransferAmount, setSplTransferAmount] = useState<number>(0);
  const [splTxhash, setSplTxhash] = useState<string | null>(null);
  const [isMainnet, setIsMainnet] = useState<boolean>(true);
  const [message, setMessage] = useState<string>("");
  const [signedMessage, setSignedMessage] = useState<string>("");
  const [splTokenAddress, setSplTokenAddress] = useState<string>("");

  /*
   * Import the Solana wallet using the ed25519 scalar private key
   * and fetch the balance.
   */
  const importSolanaWallet = async () => {
    const address = await getPublicKey(scalarKey);
    setWalletAddress(address);

    const solBalance = await getSolBalance(address, isMainnet);
    setWalletBalance(solBalance);
  };

  /*
   * Toggle which network to use.
   */
  const toggleIsMainnet = async () => {
    const updatedNetwork = !isMainnet;
    setIsMainnet(updatedNetwork);

    if (walletAddress) {
      setWalletBalance(null);
      const solBalance = await getSolBalance(walletAddress, updatedNetwork);
      setWalletBalance(solBalance);
    }
  };

  /*
   * Transfer SOL to the recipient address.
   */
  const transferSol = async () => {
    if (!walletAddress) {
      return;
    }

    const txhash = await signAndSendSolTransaction(
      scalarKey,
      walletAddress,
      recipient,
      transferAmount,
      isMainnet
    );

    setTxhash(txhash);
  };

  /*
   * Transfer SPL token to the recipient address.
   */
  const transferSpl = async () => {
    if (!walletAddress) {
      return;
    }

    const txhash = await signAndSendSPLTransferTransaction(
      scalarKey,
      walletAddress,
      splRecipient,
      splTransferAmount,
      splTokenAddress,
      isMainnet
    );

    setSplTxhash(txhash);
  };

  /*
   * Sign an arbitrary message.
   */
  const signMessage = async () => {
    const serializedMessage = message;

    // prep the private key hex
    const privateKeyHex = Buffer.from(bs58.default.decode(scalarKey)).toString(
      "hex"
    );

    // Convert the serialized transaction to a hex string
    const serializedHex = Buffer.from(serializedMessage).toString("hex");
    const transactionSignature = await signAsync(serializedHex, privateKeyHex);

    // Convert uint8 array to Buffer
    const signatureBuffer = Buffer.from(transactionSignature);
    setSignedMessage(signatureBuffer.toString("hex"));
  };

  return (
    <Box
      component="main"
      sx={(theme) => ({
        flexGrow: 1,
        backgroundColor: alpha(theme.palette.background.default, 1),
        overflow: "auto",
      })}
    >
      <Stack
        spacing={2}
        sx={{
          alignItems: "center",
          mx: 3,
          pb: 10,
          mt: { xs: 8, md: 0 },
        }}
      >
        {/* Show the private key input */}
        {!walletAddress && (
          <>
            {/* Form to input ed25119 scalar private key and an import button */}
            <p>Enter ed25519-scalar private key</p>
            <input
              type="text"
              placeholder="ed25519 scalar private key"
              onChange={(e) => setScalarKey(e.target.value)}
              value={scalarKey}
            />
            <button onClick={() => importSolanaWallet()}>Import</button>
          </>
        )}

        {/* Show the Main Dashboard */}
        {walletAddress && (
          <>
            {/* Header */}
            <Stack
              direction="row"
              sx={{
                display: { xs: "none", md: "flex" },
                width: "100%",
                alignItems: { xs: "flex-start", md: "center" },
                justifyContent: "space-between",
                maxWidth: { sm: "100%", md: "1700px" },
                pt: 1.5,
              }}
              spacing={2}
            >
              <Stack direction="row" sx={{ gap: 1 }}>
                {/* Toggle mainnet or devnet */}
                <ToggleButtonGroup
                  color="primary"
                  value={isMainnet ? "mainnet" : "devnet"}
                  exclusive
                  onChange={toggleIsMainnet}
                  aria-label="Platform"
                >
                  <ToggleButton value="mainnet">Mainnet</ToggleButton>
                  <ToggleButton value="devnet">Devnet</ToggleButton>
                </ToggleButtonGroup>
              </Stack>
            </Stack>

            {/* Show the Solana address and link the address to the Solana explorer */}
            <Stack
              sx={{
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <h1>Wallet Details</h1>
              <p>
                Solana Address:{" "}
                <a
                  className="App-link"
                  href={`https://explorer.solana.com/address/${walletAddress}${
                    isMainnet ? "" : "?cluster=devnet"
                  }`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {walletAddress}
                </a>
              </p>

              {/* Show the Solana balance, link to assets, and transaction history */}
              <p>
                SOL Balance:{" "}
                {walletBalance !== null ? walletBalance : "Loading..."}
              </p>
              <a
                className="App-link"
                href={`https://explorer.solana.com/address/${walletAddress}${
                  isMainnet ? "" : "?cluster=devnet"
                }`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Transaction History
              </a>
              <a
                className="App-link"
                href={`https://explorer.solana.com/address/${walletAddress}/tokens${
                  isMainnet ? "" : "?cluster=devnet"
                }`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Assets
              </a>

              {/* Form to transfer SOL to another account */}
              <h1>Transfer SOL</h1>
              <label htmlFor="recipient">Recipient Address</label>
              <input
                type="text"
                placeholder="Recipient Address"
                id="recipient"
                onChange={(e) => setRecipient(e.target.value)}
                value={recipient}
              />

              <label htmlFor="amount">Amount</label>
              <input
                type="number"
                placeholder="Amount"
                id="amount"
                onChange={(e) => setTransferAmount(parseFloat(e.target.value))}
                value={transferAmount}
              />
              <button onClick={() => transferSol()}>Transfer</button>
              {txhash && (
                <p>
                  Transaction Hash:{" "}
                  <a
                    className="App-link"
                    href={`https://explorer.solana.com/tx/${txhash}${
                      isMainnet ? "" : "?cluster=devnet"
                    }`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {txhash}
                  </a>
                </p>
              )}

              {/* Form to transfer SPL tokens to another account */}
              <h1>Transfer SPL Token</h1>

              <label htmlFor="spl-token-address">Token Address</label>
              <input
                type="text"
                placeholder="Token Address"
                id="spl-token-address"
                onChange={(e) => setSplTokenAddress(e.target.value)}
                value={splTokenAddress}
              />

              <label htmlFor="spl-recipient">Recipient Address</label>
              <input
                type="text"
                placeholder="Recipient Address"
                id="spl-recipient"
                onChange={(e) => setSplRecipient(e.target.value)}
                value={splRecipient}
              />

              <label htmlFor="spl-amount">Amount</label>
              <input
                type="number"
                placeholder="Amount"
                id="spl-amount"
                onChange={(e) =>
                  setSplTransferAmount(parseFloat(e.target.value))
                }
                value={splTransferAmount}
              />
              <button onClick={() => transferSpl()}>Transfer</button>
              {splTxhash && (
                <p>
                  Transaction Hash:{" "}
                  <a
                    className="App-link"
                    href={`https://explorer.solana.com/tx/${splTxhash}${
                      isMainnet ? "" : "?cluster=devnet"
                    }`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {splTxhash}
                  </a>
                </p>
              )}

              {/* Form to sign arbitrary message */}
              <h1>Sign Message</h1>
              <label htmlFor="message">Message</label>
              <input
                type="text"
                placeholder="Recipient Address"
                id="message"
                onChange={(e) => setMessage(e.target.value)}
                value={message}
              />

              <button onClick={() => signMessage()}>Sign</button>
              {signedMessage && <p>Signaure: 0x{signedMessage}</p>}
            </Stack>
          </>
        )}
      </Stack>
    </Box>
  );
}

export default App;
