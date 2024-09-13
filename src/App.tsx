import { useState } from "react";
import "./App.css";
import {
  getPublicKey,
  getSolBalance,
  signAndSendSolTransaction,
  signAndSendSPLTransferTransaction,
} from "./libs/solana";
import {
  Box,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  createTheme,
  PaletteMode,
  ThemeProvider,
  Button,
  Container,
  Typography,
  TextField,
  Link,
} from "@mui/material";
import { signAsync } from "./libs/ed25119-scalar";
import * as bs58 from "bs58";

function App() {
  const mode: PaletteMode = "light";
  const defaultTheme = createTheme({ palette: { mode } });

  const [scalarKey, setScalarKey] = useState<string>("");
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
    if (!scalarKey) {
      return;
    }

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
    if (!walletAddress || !recipient) {
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
    if (!walletAddress || !splRecipient || !splTokenAddress) {
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
    if (!message) {
      return;
    }

    // prep the private key hex
    const privateKeyHex = Buffer.from(bs58.default.decode(scalarKey)).toString(
      "hex"
    );

    // Convert the serialized transaction to a hex string
    const serializedHex = Buffer.from(message).toString("hex");
    const transactionSignature = await signAsync(serializedHex, privateKeyHex);

    // Convert uint8 array to Buffer
    const signatureBuffer = Buffer.from(transactionSignature);
    setSignedMessage(signatureBuffer.toString("hex"));
  };

  return (
    <ThemeProvider theme={defaultTheme}>
      {/* Show the private key input */}
      {!walletAddress && (
        <Container
          maxWidth="sm"
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh",
          }}
        >
          <Box
            sx={{
              width: "100%",
              bgcolor: "background.paper",
              boxShadow: 3,
              p: 4,
              borderRadius: 2,
            }}
          >
            {/* Form to input ed25119 scalar private key and an import button */}
            <Typography variant="h5" component="h1" gutterBottom>
              Enter ed25519-scalar private key
            </Typography>
            <TextField
              fullWidth
              label="Input"
              variant="outlined"
              onChange={(e) => setScalarKey(e.target.value)}
              value={scalarKey}
            />
            <Button onClick={() => importSolanaWallet()}>Import</Button>
          </Box>
        </Container>
      )}

      {/* Show the Main Dashboard */}
      {walletAddress && (
        <Container
          style={{
            height: "100vh",
          }}
        >
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
            <Typography variant="h4">Solana Wallet</Typography>
          </Stack>

          <Container
            maxWidth="sm"
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Stack
              sx={{
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              {/* Wallet Details */}
              <Typography variant="h5" sx={{ mt: 4 }}>
                Wallet Details
              </Typography>
              <Typography variant="body1">
                Solana Address:
                <Link
                  href={`https://explorer.solana.com/address/${walletAddress}${
                    isMainnet ? "" : "?cluster=devnet"
                  }`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {walletAddress}
                </Link>
              </Typography>

              <Typography variant="body1">
                SOL Balance:{" "}
                {walletBalance !== null ? walletBalance : "Loading..."}
              </Typography>
              <Link
                href={`https://explorer.solana.com/address/${walletAddress}${
                  isMainnet ? "" : "?cluster=devnet"
                }`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Transaction History
              </Link>
              <Link
                href={`https://explorer.solana.com/address/${walletAddress}/tokens${
                  isMainnet ? "" : "?cluster=devnet"
                }`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Assets
              </Link>

              {/* Transfer SOL */}
              <Typography variant="h5" sx={{ mt: 4 }}>
                Transfer SOL
              </Typography>
              <TextField
                label="Recipient Address"
                variant="outlined"
                fullWidth
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                sx={{ mt: 2 }}
              />
              <TextField
                label="Amount"
                variant="outlined"
                type="number"
                fullWidth
                value={transferAmount}
                onChange={(e) => setTransferAmount(parseFloat(e.target.value))}
                sx={{ mt: 2 }}
                inputProps={{ min: 0, step: "any" }}
              />
              <Button
                variant="contained"
                color="primary"
                onClick={transferSol}
                sx={{ mt: 2 }}
              >
                Transfer
              </Button>
              {txhash && (
                <Typography variant="body1">
                  Transaction Hash:
                  <Link
                    href={`https://explorer.solana.com/tx/${txhash}${
                      isMainnet ? "" : "?cluster=devnet"
                    }`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {txhash}
                  </Link>
                </Typography>
              )}

              {/* Transfer SPL Token */}
              <Typography variant="h5" sx={{ mt: 4 }}>
                Transfer SPL Token
              </Typography>
              <TextField
                label="Token Address"
                variant="outlined"
                fullWidth
                value={splTokenAddress}
                onChange={(e) => setSplTokenAddress(e.target.value)}
                sx={{ mt: 2 }}
              />
              <TextField
                label="Recipient Address"
                variant="outlined"
                fullWidth
                value={splRecipient}
                onChange={(e) => setSplRecipient(e.target.value)}
                sx={{ mt: 2 }}
              />
              <TextField
                label="Amount"
                variant="outlined"
                type="number"
                fullWidth
                value={splTransferAmount}
                onChange={(e) =>
                  setSplTransferAmount(parseFloat(e.target.value))
                }
                sx={{ mt: 2 }}
                inputProps={{ min: 0 }}
              />
              <Button
                variant="contained"
                color="primary"
                onClick={transferSpl}
                sx={{ mt: 2 }}
              >
                Transfer
              </Button>
              {splTxhash && (
                <Typography variant="body1">
                  Transaction Hash:
                  <Link
                    href={`https://explorer.solana.com/tx/${splTxhash}${
                      isMainnet ? "" : "?cluster=devnet"
                    }`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {splTxhash}
                  </Link>
                </Typography>
              )}

              {/* Sign Message */}
              <Typography variant="h5" sx={{ mt: 4 }}>
                Sign Message
              </Typography>
              <TextField
                label="Message"
                variant="outlined"
                fullWidth
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                sx={{ mt: 2 }}
              />
              <Button
                variant="contained"
                color="primary"
                onClick={signMessage}
                sx={{ mt: 2 }}
              >
                Sign
              </Button>
              {signedMessage && (
                <Typography variant="body1">
                  Signature: 0x{signedMessage}
                </Typography>
              )}
            </Stack>
          </Container>
        </Container>
      )}
    </ThemeProvider>
  );
}

export default App;
