import { useState } from "react";
import "./App.css";
import {
  getPublicKey,
  getSolBalance,
  signAndSendSolTransaction,
} from "./libs/solana";
import { ToggleButton, ToggleButtonGroup } from "@mui/material";

function App() {
  const [scalarKey, setScalarKey] = useState<string>("");
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [recipient, setRecipient] = useState<string>("");
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [txhash, setTxhash] = useState<string | null>(null);
  const [isMainnet, setIsMainnet] = useState<boolean>(true);

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

  return (
    <div className="App">
      <header className="App-header">
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

        {/* Show the Solana address */}
        {walletAddress && (
          <>
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

            {/* Show the Solana address and link the address to the Solana explorer */}
            <h1>Wallet Details</h1>
            <p>
              Solana Address:{" "}
              <a
                className="App-link"
                href={`https://explorer.solana.com/address/${walletAddress}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {walletAddress}
              </a>
            </p>

            {/* Show the Solana balance */}
            <p>
              SOL Balance:{" "}
              {walletBalance !== null ? walletBalance : "Loading..."}
            </p>

            {/* Form to transfer PYUSD to another account */}
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
                  href={`https://explorer.solana.com/tx/${txhash}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {txhash}
                </a>
              </p>
            )}
          </>
        )}
      </header>
    </div>
  );
}

export default App;
