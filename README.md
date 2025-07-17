# ed25519-scalar-wallet

A client-side only browser wallet built for ed25519-scalar private keys.

## Description

This is a React-based web application that serves as a client-side wallet for Ed25519-scalar private keys. It allows users to interact with the Solana blockchain, including deriving public keys, checking balances, and signing/sending transactions for SOL and SPL tokens.

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/portal-hq/ed25519-scalar-wallet.git
   cd ed25519-scalar-wallet
   ```

2. Install dependencies:

   ```bash
   yarn install
   ```

3. (Optional) Set up environment variables for custom RPC endpoints in a `.env` file:

   ```
   REACT_APP_SOLANA_DEVNET_RPC_URL=https://api.devnet.solana.com
   REACT_APP_SOLANA_MAINNET_RPC_URL=https://api.mainnet-beta.solana.com
   ```

   If not set, defaults to public Solana RPC URLs.

## Usage

1. Start the development server:

   ```bash
   yarn start
   ```

2. Open `http://localhost:3000` in your browser.

3. Use the web interface to input your base58-encoded scalar private key and perform actions like checking balances or sending transactions.

**Warning:** This is a client-side wallet. Never input your private keys on untrusted devices or networks. Ensure you understand the security implications.
