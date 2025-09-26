import { useState, useEffect } from "react";
import "./App.css";
import {
  getPublicKey,
  getSolBalance,
  getSPLTokenBalances,
  getSPLTokenInfo,
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
  useMediaQuery,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from "@mui/material";
import { signAsync } from "./libs/ed25119-scalar";
import * as bs58 from "bs58";

function App() {
  const mode: PaletteMode = "light";
  const defaultTheme = createTheme({ palette: { mode } });

  const isSmallScreen = useMediaQuery("(max-width:600px)"); // For screens smaller than 600px

  const [scalarKey, setScalarKey] = useState<string>(
    process.env.REACT_APP_TEST_SCALAR_KEY || ""
  );
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [recipient, setRecipient] = useState<string>("");
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [txhash, setTxhash] = useState<string | null>(null);
  const [splRecipient, setSplRecipient] = useState<string>("");
  const [splTransferAmount, setSplTransferAmount] = useState<number>(0);
  const [splTxhash, setSplTxhash] = useState<string | null>(null);
  const [splError, setSplError] = useState<string | null>(null);
  const [isMainnet, setIsMainnet] = useState<boolean>(true);
  const [message, setMessage] = useState<string>("");
  const [signedMessage, setSignedMessage] = useState<string>("");
  const [splTokenAddress, setSplTokenAddress] = useState<string>("");
  const [splTokenInfo, setSplTokenInfo] = useState<any | null>(null);
  const [splTokenBalances, setSplTokenBalances] = useState<{
    [key: string]: number;
  }>({});
  const [selectedTokenAddress, setSelectedTokenAddress] = useState<string>("");
  const [tokenMetadata, setTokenMetadata] = useState<{
    [key: string]: { name: string; symbol: string };
  }>({});

  /*
   * Fetch SPL token balances when wallet address changes
   */
  useEffect(() => {
    const fetchSplBalances = async () => {
      if (walletAddress) {
        try {
          const balances = await getSPLTokenBalances(walletAddress, isMainnet);
          setSplTokenBalances(balances);

          // Fetch metadata for all tokens
          const metadata: { [key: string]: { name: string; symbol: string } } =
            {};
          const tokenAddresses = Object.keys(balances);

          // Fetch metadata for each token in parallel
          const metadataPromises = tokenAddresses.map(async (address) => {
            try {
              const info = await getSPLTokenInfo(address, isMainnet);
              metadata[address] = {
                name: info.name || "Unknown Token",
                symbol: info.symbol || "UNKNOWN",
              };
            } catch (error) {
              console.warn(
                `Failed to fetch metadata for token ${address}:`,
                error
              );
              metadata[address] = {
                name: "Unknown Token",
                symbol: "UNKNOWN",
              };
            }
          });

          await Promise.all(metadataPromises);
          setTokenMetadata(metadata);
        } catch (error) {
          console.error("Error fetching SPL token balances:", error);
        }
      }
    };

    fetchSplBalances();
  }, [walletAddress, isMainnet]);

  /*
   * Import the Solana wallet using the ed25519 scalar private key
   * and fetch the balance.
   */
  const importSolanaWallet = async () => {
    if (!scalarKey) {
      return;
    }

    try {
      const address = await getPublicKey(scalarKey);
      setWalletAddress(address);

      const solBalance = await getSolBalance(address, isMainnet);
      setWalletBalance(solBalance);
    } catch (e) {
      console.log(e);
      alert("Invalid private key");
    }
  };

  /*
   * Toggle which network to use.
   */
  const toggleIsMainnet = async (event: React.MouseEvent, value: any) => {
    const target = event.target as HTMLButtonElement;
    const buttonValue = target.value;

    const updatedIsMainnet = buttonValue === "mainnet";
    const didChange = updatedIsMainnet !== isMainnet;

    setIsMainnet(updatedIsMainnet);

    if (walletAddress && didChange) {
      setWalletBalance(null);
      setSplTokenBalances({});
      setTokenMetadata({});
      setSelectedTokenAddress("");
      setSplTokenInfo(null);

      // Re-fetch SOL balance
      const solBalance = await getSolBalance(walletAddress, updatedIsMainnet);
      setWalletBalance(solBalance);

      // Re-fetch SPL token balances and metadata
      try {
        const balances = await getSPLTokenBalances(
          walletAddress,
          updatedIsMainnet
        );
        setSplTokenBalances(balances);

        // Fetch metadata for all tokens
        const metadata: { [key: string]: { name: string; symbol: string } } =
          {};
        const tokenAddresses = Object.keys(balances);

        // Fetch metadata for each token in parallel
        const metadataPromises = tokenAddresses.map(async (address) => {
          try {
            const info = await getSPLTokenInfo(address, updatedIsMainnet);
            metadata[address] = {
              name: info.name || "Unknown Token",
              symbol: info.symbol || "UNKNOWN",
            };
          } catch (error) {
            console.warn(
              `Failed to fetch metadata for token ${address}:`,
              error
            );
            metadata[address] = {
              name: "Unknown Token",
              symbol: "UNKNOWN",
            };
          }
        });

        await Promise.all(metadataPromises);
        setTokenMetadata(metadata);
      } catch (error) {
        console.error("Error fetching SPL token balances:", error);
      }
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
    if (!walletAddress || !splRecipient || !selectedTokenAddress) {
      return;
    }

    try {
      const txhash = await signAndSendSPLTransferTransaction(
        scalarKey,
        walletAddress,
        splRecipient,
        splTransferAmount,
        selectedTokenAddress,
        isMainnet
      );
      setSplTxhash(txhash);
      setSplError(null);
    } catch (e: any) {
      console.error(e);
      setSplTxhash(null);
      setSplError(e.message);
    }
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
              display: "flex",
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
              color="secondary"
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
                width: "100%",
              }}
            >
              {/* Wallet Details */}
              <Typography variant="h5" sx={{ mt: 4 }}>
                Wallet Details on Solana{" "}
                <b>{isMainnet ? "Mainnet" : "Devnet"}</b>
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  whiteSpace: "normal", // Allow text to wrap
                  wordWrap: "break-word", // Break long words
                  overflowWrap: "break-word", // Break long continuous text
                }}
              >
                Address:{" "}
                <Link
                  href={`https://explorer.solana.com/address/${walletAddress}${
                    isMainnet ? "" : "?cluster=devnet"
                  }`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {isSmallScreen
                    ? walletAddress.slice(0, 10) +
                      "..." +
                      walletAddress.slice(-10)
                    : walletAddress}
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
                Transfer SOL
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

              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel>Select Token</InputLabel>
                <Select
                  value={selectedTokenAddress}
                  onChange={async (e) => {
                    const tokenAddress = e.target.value as string;
                    setSelectedTokenAddress(tokenAddress);
                    setSplTokenAddress(tokenAddress);
                    if (tokenAddress) {
                      try {
                        const info = await getSPLTokenInfo(
                          tokenAddress,
                          isMainnet
                        );
                        console.info(info);
                        setSplTokenInfo(info);
                      } catch (e) {
                        setSplTokenInfo(null);
                      }
                    } else {
                      setSplTokenInfo(null);
                    }
                  }}
                  label="Select Token"
                >
                  <MenuItem value="">
                    <em>Select a token</em>
                  </MenuItem>
                  {Object.entries(splTokenBalances).map(
                    ([address, balance]) => {
                      const metadata = tokenMetadata[address];
                      const displayName = metadata
                        ? `${metadata.symbol} (${metadata.name})`
                        : `${address.slice(0, 8)}...${address.slice(-8)}`;

                      return (
                        <MenuItem key={address} value={address}>
                          {displayName} - Balance: {balance}
                        </MenuItem>
                      );
                    }
                  )}
                </Select>
              </FormControl>
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
                Transfer SPL
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
              {splError && (
                <Typography variant="body1" color="error">
                  {splError}
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
