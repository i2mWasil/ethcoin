# AI-Powered Hybrid CDP Protocol

## Overview

This project implements an **AI-driven decentralized lending protocol** that evolves from traditional overcollateralized loans to **trust-based, low or zero collateral lending**.

The system combines:

* **Collateralized Debt Positions (CDP)** (like MakerDAO)
* **AI-based credit scoring**
* **Soulbound identity tokens**
* **Dynamic collateral requirements**

---

## Core Idea

Traditional DeFi lending requires **high collateral (150%+)**, making it inefficient.

This protocol introduces:

> **On-chain credit scoring powered by AI → reduces collateral requirements over time**

---

## How It Works

### User Flow

1. User deposits ETH as collateral
2. Protocol mints a stable token (**USX**)
3. AI evaluates wallet behavior
4. Credit score is updated (stored as NFT)
5. Future loans require **less collateral**

---

### System Architecture

```text
User → Deposit ETH → CDP Contract
     ↓
Mint USX (loan)
     ↓
AI Model analyzes wallet
     ↓
Score updated on-chain (NFT)
     ↓
Next loan uses improved collateral ratio
```

---

## Components

### 1. CDP Engine

* Accepts ETH deposits
* Mints stablecoin (USX)
* Tracks user debt and collateral

### 2. AI Credit Scoring

* Inputs:

  * Wallet age
  * Transaction count
  * DeFi interactions
  * Activity patterns
* Outputs:

  * Score (0–100)

### 3. Soulbound Credit Token (NFT)

* Non-transferable
* Stores user credit score
* Updates after each repayment

### 4. Dynamic Collateral Ratio

| Score  | Collateral Required |
| ------ | ------------------- |
| 0–30   | 150%                |
| 31–60  | 120%                |
| 61–85  | 100%                |
| 86–100 | 80%                 |

---

## What is USX?

USX is an ERC-20 token representing:

> Borrowed value against ETH collateral

Currently:

* ERC-20 token
* Loan representation
* Not a fully pegged stablecoin yet

---

# Tech Stack

* **Smart Contracts:** Solidity + Foundry
* **Frontend:** React + Vite + Ethers.js
* **Backend/AI:** Python (scikit-learn)
* **Blockchain Access:** QuickNode
* **Data Source:** Etherscan

---

# Setup Guide

---

## 1. Install Foundry

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

Verify:

```bash
forge --version
```

---

## 2. Setup MetaMask

1. Install MetaMask extension
2. Create wallet
3. Switch network → **Sepolia**
4. Get test ETH from faucet

Example faucet:

* Alchemy Faucet

---

## 3. Get Required Credentials

### QuickNode RPC

1. Create endpoint on QuickNode
2. Select **Ethereum → Sepolia**
3. Copy HTTP URL

---

### Private Key (MetaMask)

1. Account → Account Details
2. Export Private Key
3. Store securely

---

## 4. Project Structure

```text
hybrid-cdp/
├── contracts/
├── dataset/
├── model/
└── frontend/
```

---

# Dataset Generation (AI)

## Install dependencies

```bash
pip install pandas requests tqdm python-dotenv
```

---

## Configure `.env`

```bash
ETHERSCAN_API_KEY=your_key
NETWORK=sepolia
```

---

## Run dataset builder

```bash
cd dataset
python build_dataset.py
```

---

## Output

```text
wallet_data.csv
```

Contains:

* tx_count
* wallet_age
* interactions
* generated score

---

# Smart Contract Setup

---

## Install dependencies

```bash
cd contracts
forge install OpenZeppelin/openzeppelin-contracts
```

---

## Build contracts

```bash
forge build
```

Outputs:

```text
out/
```

---

## Deploy contracts

```bash
forge script script/Deploy.s.sol \
--rpc-url YOUR_QUICKNODE_URL \
--private-key YOUR_PRIVATE_KEY \
--broadcast -vvvv
```

---

## Deployment Output

You’ll get contract addresses:

```text
USX → 0x...
CreditScoreNFT → 0x...
CDP → 0x...
```

---

## Save to frontend `.env`

```bash
VITE_CDP_ADDRESS=0x...
VITE_NFT_ADDRESS=0x...
```

---

# Frontend Setup

---

## Install dependencies

```bash
cd frontend
npm install
npm install ethers
```

---

## Run frontend

```bash
npm run dev
```

Open:

```text
http://localhost:5173
```

---

## Features

* Connect wallet
* Deposit ETH
* Mint USX
* View credit score

---

# How Everything Connects

```text
Frontend → QuickNode → Smart Contracts
                ↑
        AI Score pushed via backend
                ↑
Dataset (Etherscan)
```

---

# Future Improvements

* Chainlink price oracle
* Liquidation engine
* True stablecoin peg
* zk-based identity scoring
* Multi-chain support

---

# Key Innovation

> Combines **AI + DeFi + Identity (SBT)** to move from
> collateral-based lending → **trust-based lending**

---

# Disclaimer

* This is a prototype
* Not production-ready
* Do NOT use real funds

---

# Contributing

Feel free to fork and improve:

* Better scoring models
* UI improvements
* Risk management

---

# Final Note

This project demonstrates:

* Smart contract engineering
* AI + blockchain integration
* Full-stack Web3 development

---
