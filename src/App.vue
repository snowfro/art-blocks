<template>
  <div id="main-container">
    <header>
      <nav class="navbar navbar-expand-md navbar-dark bg-primary fixed-top">
        <router-link :to="{ name: 'home' }" class="navbar-brand">
          TOKN
        </router-link>

        <div class="col">
          <ul class="navbar-nav justify-content-end float-left">
            <li class="nav-item">
              <router-link :to="{ name: 'home' }" class="nav-link d-none d-sm-block">Home</router-link>
            </li>
            <!--<li class="nav-item">-->
              <!--<router-link :to="{ name: 'mint' }" class="nav-link d-none d-sm-block">Mint</router-link>-->
            <!--</li>-->
            <!--<li class="nav-item">-->
              <!--<router-link :to="{ name: 'artist' }" class="nav-link d-none d-sm-block">Art Node</router-link>-->
            <!--</li>-->
            <li class="nav-item">
              <router-link :to="{ name: 'mytokens' }" class="nav-link d-none d-sm-block">My TOKNs</router-link>
            </li>
          </ul>
        </div>
        <!--<div class="col">-->
          <!--<form class="form-inline my-2 my-lg-0 d-none d-sm-block float-right" novalidate>-->
            <!--<input class="form-control mr-sm-2" type="search"-->
                   <!--placeholder="Art Node Address..."-->
                   <!--v-model="sacAddress">-->
            <!--<button class="btn btn-info my-2 my-sm-0" type="button"-->
                    <!--v-on:click="goToSAC()">Art Node Contract-->
            <!--</button>-->
          <!--</form>-->
        <!--</div>-->
      </nav>
    </header>

    <main role="main" class="container">
      <router-view></router-view>
    </main>

    <hr/>
    <current-network></current-network>
  </div>
</template>

<script>
  /* global web3:true */

  import Web3 from 'web3';
  import {mapGetters, mapState} from 'vuex';
  import * as actions from './store/actions';
  import * as mutations from './store/mutation-types';
  import CurrentNetwork from './components/ui-controls/CurrentNetwork';
  import FontAwesomeIcon from '@fortawesome/vue-fontawesome';

  export default {
    name: 'app',
    components: {
      FontAwesomeIcon,
      CurrentNetwork
    },
    computed: {
      ...mapGetters([]),
      ...mapState([]),
    },
    data() {
      return {
        sacAddress: undefined
      };
    },
    methods: {
      goToSAC: function () {
        this.$router.push({
          name: 'SACManagement', params: {sacAddress: this.sacAddress}
        });
      }
    },
    mounted() {

      let bootStrappedWeb3;

      // Checking if Web3 has been injected by the browser (Mist/MetaMask)
      if (typeof web3 !== 'undefined') {
        bootStrappedWeb3 = new Web3(web3.currentProvider);
      } else {
        console.log('No web3! You should consider trying MetaMask or an Ethereum browser');
        console.log('Falling back to using HTTP Provider');

        bootStrappedWeb3 = new Web3(new Web3.providers.HttpProvider("https://mainnet.infura.io/nbCbdzC6IG9CF6hmvAVQ"));
      }

      window.web3 = bootStrappedWeb3;

      // Bootstrap the full app
      this.$store.dispatch(actions.INIT_APP, bootStrappedWeb3);

      setInterval(function () {
        console.log('getting next hash');
        this.$store.dispatch(actions.NEXT_HASH);
      }.bind(this), 2000);
    },
  };
</script>

<style lang="scss">

  $body-bg: #efefef;
  $body-color: #545454;
  $primary: #ffb33a;

  $font-family-base: 'Avenir', Helvetica, Arial, sans-serif;

  @import '../node_modules/bootstrap/scss/bootstrap.scss';

  /* Sticky footer styles
-------------------------------------------------- */
  html {
    position: relative;
    min-height: 100%;
  }

  body {
    margin-bottom: 60px;
    margin-top: 10px;
    padding-top: 70px;
    padding-bottom: 20px;
  }

  .navbar-brand {
    font-size: 1.5rem;
  }

  /* mobile only */
  @media screen and (max-width: 767px) {
    body {
      padding-bottom: 100px;
    }

    .footer {
      .col-sm {
        padding-bottom: 10px;
      }
    }

    h1 {
      font-size: 1.5rem;
    }
  }

  .footer {
    position: absolute;
    bottom: 0;
    width: 100%;
    min-height: 60px;
    line-height: 25px;
    background-color: $primary;
  }

  body > .container {
    padding: 60px 60px 0;
  }

  .footer > .container {
    padding-right: 15px;
    padding-left: 15px;
    padding-top: 15px;
    color: #f2f5fb;

    .slogan {
      color: rgba(255, 255, 255, 0.5);
    }

    a {
      color: #f2f5fb;
      padding-left: 2px;
      padding-right: 2px;
    }
  }

  .btn-group-vertical > button {
    margin-bottom: 10px;
  }
</style>
