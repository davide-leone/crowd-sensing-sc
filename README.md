# Smart Contract Coordinated Privacy Preserving Crowd-Sensing Campaigns

This repository contains the implementation of the solution proposed in the paper:

> **"Smart Contract Coordinated Privacy Preserving Crowd-Sensing Campaigns"**  
> *Luca Bedogni and Stefano Ferretti, 2024*

The project demonstrates how smart contracts can be used to coordinate privacy-preserving crowd-sensing campaigns, ensuring accountability and incentivization while protecting user privacy.

---

## Repository Structure

### `CrowdSensingProject`
This folder contains the main smart contract implementation and related development artifacts.

- **`contracts/`** – Solidity smart contract source code  
- **`test/`** – JavaScript test scripts for validating the contract functionality  
- **`migrations/`** – Deployment scripts for Truffle  
- **`build/`** – Compiled contract artifacts (auto-generated)  
- **`node_modules/`** – Node.js dependencies (auto-generated)  
- **`truffle-config.js`** – Truffle configuration file  
- **`package.json` & `package-lock.json`** – Project metadata and dependencies

### `Results Analysis`
Contains tools for analyzing the performance and gas consumption of the contract.

- **Jupyter Notebook** – Used to analyze and plot gas usage results  
- **Generated Images** – Visual representations of the analysis results

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/)
- [Truffle](https://trufflesuite.com/)
- [Ganache](https://trufflesuite.com/ganache/)
- [Python](https://www.python.org/)
- [Jupyter Notebook](https://jupyter.org/)

### Installation
```bash
cd CrowdSensingProject
npm install -g truffle
npm install chai chai-as-promised
```

## Compile, deploy and test the solution

Open two terminals (T1 and T2) in the `CrowdSensingProject` folder.

### Compile (T1)
```bash
truffle compile
```
### Deploy (T2)
```bash
npx ganache -a [n_accounts]
```

### Run Tests (T1)
```bash
truffle test
```

## Analyze Results
Navigate to the `Results Analysis` folder and open the Jupyter notebook:
```bash
jupyter notebook
```

## License
This project is provided for academic and research purposes. For licensing inquiries, please contact the authors of the original paper.
