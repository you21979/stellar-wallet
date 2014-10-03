var StexDev = require("stex/dev");
var Stex    = require("stex");
var Promise = Stex.Promise;
var hash    = require("../lib/util/hash");
var sign    = require("../lib/util/sign");
process.env["NODE_ENV"]="test";

var testHelper  = module.exports;
testHelper.Stex = Stex;

var SEED                   = "iAziZHvikuV/KLVinhNAo15vwwFxLSq2X6H9bjNw1Ss=";
var KEYPAIR                = sign.keyPair(SEED);
testHelper.testKeyPairSeed = SEED;
testHelper.testKeyPair     = KEYPAIR;

var clearDb = function() {
  return Promise.all([
    db.raw("TRUNCATE TABLE wallets"),
    db.raw("TRUNCATE TABLE wallets_v2"),
  ]);
};

var clearRedis = function() {
  return stex.redis.flushdbAsync();
};

var makeWallet = function(params) {
  return Promise
    .props({ 
      id:            hash.locator(params.id), 
      recoveryId:    params.recoveryId ? hash.locator(params.recoveryId) : null,
      authTokenHash: hash.sha2(params.authToken), 
      mainData:      params.mainData, 
      recoveryData:  params.recoveryData, 
      keychainData:  params.keychainData
    })
    .then(function(params) {
      return db("wallets").insert(params);
    });
};

var makeWalletV2 = function(params) {
  return db("wallets_v2").insert({
    lockVersion:   0,
    createdAt:     new Date(),
    updatedAt:     new Date(),

    publicKey:     testHelper.testKeyPair.publicKey,
    walletId:      hash.sha2(params.username),

    username:      params.username,
    salt:          "somesaltgoeshere",
    kdfParams:     JSON.stringify({
      algorithm: "scrypt",
      n: Math.pow(2,16),
      r: 8,
      p: 1
    }),

    mainData:      params.mainData, 
    keychainData:  params.keychainData,
    totpKey:       params.totpKey
  });
};

var loadFixtures = function() {
  return Promise.all([
    makeWallet({ id:'1', recoveryId:'1', authToken:'1', mainData:'foo', recoveryData:'foo', keychainData:'foo' }),
    makeWallet({ id:'3', recoveryId:'3', authToken:'3', mainData:'foo3', recoveryData:'foo3', keychainData:'foo3' }),
    makeWallet({ id:'4', authToken:'4', mainData:'foo4', keychainData:'foo4' }),

    makeWalletV2({username: "scott@stellar.org", mainData:'foo', keychainData:'foo'}),
    makeWalletV2({username: "david@stellar.org", mainData:'foo', keychainData:'foo'}),
    makeWalletV2({username: "mfa@stellar.org",   mainData:'foo', keychainData:'foo', totpKey:new Buffer('mytotpKey').toString("base64")}),
  ]);
};

testHelper.makeString = function(size) {
  var x = "";
  for(var i = 0; i < size; i++) {
    x += "a";
  }
  return x;
};

testHelper.blankTest = function(prop) {
  return function(done) {
    delete this.params[prop];

    this.submit()
      .expect(400)
      .expectBody({ 
        status: "fail",
        code:   "missing",
        field:  prop
      })
      .end(done);
  };
};


testHelper.badHashTest = function(prop) {
  return function(done) {
    var hashProp = prop + "Hash";
    this.params[hashProp] = "badhash";

    this.submit()
      .expect(400)
      .expectBody({ 
        status: "fail",
        code:   "invalid_hash",
        field:  prop
      })
      .end(done);
  };
};

beforeEach(function(done) {
  clearDb()
    .then(clearRedis)
    .then(loadFixtures)
    .then(function() { done(); });
});

before(function(done) {
  require("../lib/app")
    .init(true)
    .then(function(stex){ 
      done(); 
    });
});
