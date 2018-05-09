import Vue from 'vue';
import Vuex from 'vuex';
import * as actions from './actions';
import * as mutations from './mutation-types';
import _ from 'lodash';
import Web3 from 'web3';
import createLogger from 'vuex/dist/logger';
import {getEtherscanAddress, getNetIdString} from '../utils';
import contract from 'truffle-contract';
import dARTJson from '../../build/contracts/DART.json';

const dart = contract(dARTJson);

Vue.use(Vuex);

const store = new Vuex.Store({
  plugins: [createLogger()],
  state: {
    // connectivity
    web3: null,
    account: null,
    accountBalance: null,
    currentNetwork: null,
    etherscanBase: null,
    assetsPurchasedByAccount: [],

    // contract metadata
    contractName: '',
    contractSymbol: '',
    contractAddress: '',

    // contract totals
    totalSupply: null,
    totalContributionsInWei: null,
    totalContributionsEther: null,
    pricePerBlockInWei: null,
    pricePerBlockInEth: null,
    maxBlockPurchaseInOneGo: null,

    // contract addresses
    curatorAddress: null,
    assets: [],

    hash: null,
    blockNumber: null,
    nextBlockToFund: null,
    hashes: {}
  },
  getters: {
    assetByTokenId: (state) => (tokenId) => {
      return _.find(state.assets, (asset) => asset.tokenId.toString() === tokenId.toString());
    },
    getHashMatch: (state) => () => {
      let matchAsset = _.find(state.assets, {blockhash: state.hash});
      console.log(matchAsset);
      if (!matchAsset) {
        return "no match";
      }
      return `Matched token ${matchAsset.tokenId}`;
    }
  },
  mutations: {
    [mutations.SET_ALL_ASSETS](state, assets) {
      Vue.set(state, 'assets', state.assets);
    },
    [mutations.SET_ASSET](state, asset) {
      if (!_.find(state.assets, {tokenId: asset.tokenId})) {
        state.assets.push(asset);
      }
      Vue.set(state, 'assets', state.assets);
    },
    [mutations.SET_ASSETS_PURCHASED_FROM_ACCOUNT](state, tokens) {
      Vue.set(state, 'assetsPurchasedByAccount', tokens);
    },
    [mutations.SET_TOTAL_PURCHASED](state, {totalContributionsInWei, totalContributionsInEther}) {
      state.totalContributionsInWei = totalContributionsInWei;
      state.totalContributionsInEther = totalContributionsInEther;
    },
    [mutations.SET_CONTRACT_DETAILS](state, {name, symbol, totalSupply, curatorAddress, contractAddress, pricePerBlockInWei, pricePerBlockInEth, maxBlockPurchaseInOneGo}) {
      state.totalSupply = totalSupply;
      state.contractSymbol = symbol;
      state.contractName = name;
      state.curatorAddress = curatorAddress;
      state.contractAddress = contractAddress;
      state.pricePerBlockInWei = pricePerBlockInWei;
      state.pricePerBlockInEth = pricePerBlockInEth;
      state.maxBlockPurchaseInOneGo = maxBlockPurchaseInOneGo;
    },
    [mutations.SET_ACCOUNT](state, {account, accountBalance}) {
      state.account = account;
      state.accountBalance = accountBalance;

      store.dispatch(actions.GET_ASSETS_PURCHASED_FOR_ACCOUNT);
    },
    [mutations.SET_CURRENT_NETWORK](state, currentNetwork) {
      state.currentNetwork = currentNetwork;
    },
    [mutations.SET_ETHERSCAN_NETWORK](state, etherscanBase) {
      state.etherscanBase = etherscanBase;
    },
    [mutations.SET_WEB3](state, web3) {
      state.web3 = web3;
    },
    [mutations.SET_HASH](state, {hash, blockNumber, nextBlockToFund}) {
      console.log(`block - 1: ${blockNumber - 1} nextHash(): ${hash}`);
      state.hash = hash;
      state.blockNumber = blockNumber;
      state.nextBlockToFund = nextBlockToFund;

      state.hashes[blockNumber] = {

      };




    },
  },
  actions: {
    [actions.GET_ASSETS_PURCHASED_FOR_ACCOUNT]({commit, dispatch, state}) {
      dart.deployed()
        .then((contract) => {
          return contract.tokensOf(state.account)
            .then((tokens) => {
              commit(mutations.SET_ASSETS_PURCHASED_FROM_ACCOUNT, tokens);
            });
        })
        .catch((e) => {
          console.error(e);
        });
    },
    [actions.GET_CURRENT_NETWORK]({commit, dispatch, state}) {
      getNetIdString()
        .then((currentNetwork) => {
          commit(mutations.SET_CURRENT_NETWORK, currentNetwork);
        });
      getEtherscanAddress()
        .then((etherscanBase) => {
          commit(mutations.SET_ETHERSCAN_NETWORK, etherscanBase);
        });
    },
    [actions.INIT_APP]({commit, dispatch, state}, web3) {

      // NON-ASYNC action - set web3 provider on init
      dart.setProvider(web3.currentProvider);

      //dirty hack for web3@1.0.0 support for localhost testrpc, see https://github.com/trufflesuite/truffle-contract/issues/56#issuecomment-331084530
      if (typeof dart.currentProvider.sendAsync !== 'function') {
        dart.currentProvider.sendAsync = function () {
          return dart.currentProvider.send.apply(
            dart.currentProvider, arguments
          );
        };
      }

      // Set the web3 instance
      commit(mutations.SET_WEB3, web3);

      // Find current network
      dispatch(actions.GET_CURRENT_NETWORK);

      web3.eth.getAccounts()
        .then((accounts) => {

          let account = accounts[0];

          const setAccountAndBalance = (account) => {
            return web3.eth.getBalance(account)
              .then((balance) => {
                let accountBalance = Web3.utils.fromWei(balance);
                // store the account details
                commit(mutations.SET_ACCOUNT, {account, accountBalance});
              });
          };

          const refreshHandler = () => {
            web3.eth.getAccounts()
              .then((updatedAccounts) => {
                if (updatedAccounts[0] !== account) {
                  account = updatedAccounts[0];
                  return setAccountAndBalance(account);
                }
              });
          };

          // Every second check if the main account has changed
          setInterval(refreshHandler, 1000);

          // init the KODA contract
          dispatch(actions.REFRESH_CONTRACT_DETAILS);

          if (account) {
            return setAccountAndBalance(account);
          }
        })
        .catch(function (error) {
          console.log('ERROR - account locked', error);
          // TODO handle locked metamask account
        });
    },
    [actions.GET_ALL_ASSETS]({commit, dispatch, state}) {
      dart.deployed()
        .then((contract) => {

          let mintEvent = contract.MintDART({}, {
            fromBlock: 0, // FIXME use contract deployed blocknumber?! or maybe expose some method to get all tokens ... is this possible ?
            toBlock: 'latest' // wait until event comes through
          });

          mintEvent.watch(function (error, result) {
            if (!error) {
              console.log(result);
              commit(mutations.SET_ASSET, {
                owner: result.args._owner,
                tokenId: result.args._tokenId.toNumber(10),
                blockhash: result.args._blockhash,
                nickname: result.args._nickname,
              });
            } else {
              console.log('Failure', error);
            }
          });
        });
    },
    [actions.REFRESH_CONTRACT_DETAILS]({commit, dispatch, state}) {
      dart.deployed()
        .then((contract) => {

          Promise.all([contract.name(), contract.symbol(), contract.totalSupply(), contract.owner(), contract.address, contract.pricePerBlock(), contract.maxBlockPurchaseInOneGo()])
            .then((results) => {
              commit(mutations.SET_CONTRACT_DETAILS, {
                name: results[0],
                symbol: results[1],
                totalSupply: results[2].toString(),
                curatorAddress: results[3],
                contractAddress: results[4],
                pricePerBlockInWei: results[5],
                pricePerBlockInEth: Web3.utils.fromWei(results[5].toString(10), 'ether'),
                maxBlockPurchaseInOneGo: results[6].toNumber(10),
              });

              dispatch(actions.GET_ALL_ASSETS);
            });

          Promise.all([contract.totalContributionsInWei()])
            .then((results) => {
              commit(mutations.SET_TOTAL_PURCHASED, {
                totalContributionsInEther: Web3.utils.fromWei(results[0].toString(10), 'ether'),
                totalContributionsInWei: results[0].toString(10)
              });
            });
        }).catch((error) => console.log('Something went bang!', error));
    },
    [actions.NEXT_HASH]({commit, dispatch, state}) {
      dart.deployed()
        .then((contract) => {
          Promise.all([contract.nextHash(), contract.blockNumber(), contract.getNextBlockToFund()])
            .then((results) => {
              commit(mutations.SET_HASH, {
                hash: results[0],
                blockNumber: results[1].toNumber(10),
                nextBlockToFund: results[2].toNumber(10),
              });
            });
        })
        .catch((e) => {
          console.error(e);
        });
    },
    [actions.MINT]({commit, dispatch, state}, {blockhash, nickname, tokenId}) {
      dart.deployed()
        .then((contract) => {
          console.log(`minting... ${blockhash} -  ${nickname} - ${tokenId}`);
          let tx = contract.mint(blockhash, tokenId, nickname, {from: state.account});

          console.log(tx);
          tx
            .then((data) => {
              console.log(data);
              setInterval(function () {
                dispatch(actions.GET_ALL_ASSETS);
              }, 10000);
            })
            .catch((e) => {
              console.error(e);
            });
        })
        .catch((e) => {
          console.error(e);
        });
    }
  }
});

export default store;
