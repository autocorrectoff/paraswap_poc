import {
  constructSDK,
  Token,
  constructFetchFetcher,
  constructEthersContractCaller,
} from "@paraswap/sdk";
import BigNumber from "bignumber.js";
import { Contract, providers, Wallet } from "ethers";
import fetch from "isomorphic-fetch";
import { OptimalRate } from "paraswap-core";

// https://github.com/paraswap/paraswap-sdk
// https://developers.paraswap.network/api/examples
// https://www.npmjs.com/package/@paraswap/sdk

const networks = {
  ethereum: 1,
  ropsten: 3,
  rinkeby: 4,
  kovan: 42,
  binance: 56,
  polygon: 137,
  avalanche: 43114,
};

(async () => {
  const fetcher = constructFetchFetcher(fetch);

  let wallet = new Wallet(
    "your_private_key_here"
  );
  const provider = new providers.JsonRpcProvider("your_node_url_here");
  wallet = wallet.connect(provider);

  const address = await wallet.getAddress();
  const braveAddr = "0xEae2613ee0e4a624201B6Bab69Da9A5Acb86AeD9";
  const contractCaller = constructEthersContractCaller({
    providerOrSigner: wallet,
    Contract,
  }, address);

  const paraSwap = constructSDK({
    network: networks.polygon,
    fetcher,
    contractCaller,
  });

  interface TxInput {
    srcToken: string;
    srcDecimals: number;
    srcAmount: string;
    destToken: string;
    destDecimals: number;
    destAmount: string;
    priceRoute: OptimalRate;
    userAddress: string;
    partner?: string;
    partnerAddress?: string;
    partnerFeeBps?: number;
    receiver?: string;
    permit?: string;
    deadline?: string;
  }

  const tokens = await getSupportedTokens();
  console.log(tokens.length);

  const matic = tokens.filter((t) => t.symbol == "MATIC")[0];
  const tether = tokens.filter((t) => t.symbol == "USDT")[0];

  const token1 = matic;
  const token2 = tether;

  console.log(token1);
  console.log(token2);

  const amount = new BigNumber(1).times(10 ** token1.decimals).toFixed(0);
  const slippage = 1; // 0.1 | 0.5 | 1

  const rate = await getRate(
    token1.address,
    token2.address,
    amount,
    token1.decimals,
    token2.decimals,
    address
  );
  console.log(rate);

  const minAmount = calculateMinAmount(rate.destAmount, slippage);
  const minAmountFloat = toFloat(minAmount, rate.destDecimals, 10);
  console.log(`min amount: ${minAmountFloat} for ${slippage}% slippage`);
  const displayDestAmount = toFloat(rate.destAmount, rate.destDecimals, 10);
  console.log(`amount of ${token2.symbol} to receive: ${displayDestAmount}`);

  const partnerFee = 2 * 100;

  const input: TxInput = {
    srcToken: token1.address,
    srcDecimals: token1.decimals,
    srcAmount: rate.srcAmount,
    destToken: token2.address,
    destDecimals: token2.decimals,
    destAmount: rate.destAmount,
    priceRoute: rate,
    userAddress: address,
    partnerAddress: braveAddr,
    partnerFeeBps: partnerFee,
  };

  // approve ERC20
  const approval = await paraSwap.approveToken(amount, token1.address);
  console.log(approval);

  // build tx
  const tx = await createSwapTx(input);
  delete tx.gas;

  // broadcast tx
  const txResponse = await wallet.sendTransaction(tx);
  console.log(txResponse);
  await txResponse.wait(1);


  async function getSupportedTokens() {
    return (await paraSwap.getTokens()) as Token[];
  }

  async function getRate(
    srcToken: string,
    destToken: string,
    amount: string,
    srcDecimals: number,
    destDecimals: number,
    userAddress: string
  ) {
    return paraSwap.getRate({
      srcToken,
      destToken,
      amount,
      srcDecimals,
      destDecimals,
      userAddress,
    });
  }

  function calculateMinAmount(destAmount: string, slippage: number) {
    return new BigNumber(destAmount).times(1 - slippage / 100).toFixed(0);
  }

  function toFloat(amount: string, tokenDecimals: number, decimals: number) {
    return new BigNumber(amount).div(10 ** tokenDecimals).toFixed(decimals);
  }

  async function createSwapTx(input: TxInput) {
    return await paraSwap.buildTx({
      ...input,
    });
  }
})();
