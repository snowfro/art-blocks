pragma solidity ^0.4.24;

import "./InterfaceToken.sol";

/**
* @title SimpleArtistContract
*/
contract SimpleArtistContract  {
  using SafeMath for uint256;

  event Purchased(address indexed _funder, uint256 indexed _tokenId, uint256 _blocksPurchased, uint256 _totalValue);
  event PurchaseBlock(address indexed _funder, uint256 indexed _tokenId, bytes32 _blockhash, uint256 _block);

  modifier onlyValidAmounts() {
    require(msg.value >= 0);

    // Min price
    require(msg.value >= (pricePerBlockInWei * minBlockPurchaseInOneGo));

    // max price
    require(msg.value <= (pricePerBlockInWei * maxBlockPurchaseInOneGo));
    _;
  }

  /**
   * @dev Throws if called by any account other than the artist.
   */
  modifier onlyArtist() {
    require(msg.sender == artist);
    _;
  }

  address public artist;

  InterfaceToken public token;

  uint256 public pricePerBlockInWei;
  uint256 public maxBlockPurchaseInOneGo;
  uint256 public minBlockPurchaseInOneGo;
  bool public onlyShowPurchased = false;

  address public foundationAddress = 0x2b54605eF16c4da53E32eC20b7F170389350E9F1;
  uint256 public foundationPercentage = 5; // 5% to foundation

  mapping(uint256 => uint256) internal blocknumberToTokenId;
  mapping(uint256 => uint256[]) internal tokenIdToPurchasedBlocknumbers;

  uint256 public lastPurchasedBlock = 0;

  constructor(InterfaceToken _token, uint256 _pricePerBlockInWei, uint256 _maxBlockPurchaseInOneGo, uint256 _minBlockPurchaseInOneGo, address _artist) public {
    require(_artist != address(0));
    artist = _artist;

    token = _token;

    pricePerBlockInWei = _pricePerBlockInWei;
    maxBlockPurchaseInOneGo = _maxBlockPurchaseInOneGo;
    minBlockPurchaseInOneGo = _minBlockPurchaseInOneGo;

    // set to current block mined in
    lastPurchasedBlock = block.number;
  }

  /**
  * @dev allows payment direct to contract - if no token will store value on contract
  */
  function() public payable {
    if (token.hasTokens(msg.sender)) {
      purchase(token.firstToken(msg.sender));
    }
    else {
      // 5% to foundation
      uint foundationShare = msg.value / 100 * foundationPercentage;
      foundationAddress.transfer(foundationShare);

      // artists sent the remaining value
      uint artistTotal = msg.value - foundationShare;
      artist.transfer(artistTotal);
    }
  }

  /**
   * @dev purchase blocks with your Token ID to be displayed for a specific amount of blocks
   * @param _tokenId the InterfaceToken token ID
   */
  function purchase(uint256 _tokenId) public payable onlyValidAmounts {
    require(token.exists(_tokenId));

    // determine how many blocks purchased
    uint256 blocksToPurchased = msg.value / pricePerBlockInWei;

    // Start purchase from next block the current block is being mined
    uint256 nextBlockToPurchase = block.number + 1;

    // If next block is behind the next block to purchase, set next block to the last block
    if (nextBlockToPurchase < lastPurchasedBlock) {
      // reducing wasted loops to find a viable block to purchase
      nextBlockToPurchase = lastPurchasedBlock;
    }

    uint8 purchased = 0;
    while (purchased < blocksToPurchased) {

      if (tokenIdOf(nextBlockToPurchase) == 0) {
        purchaseBlock(nextBlockToPurchase, _tokenId);
        purchased++;
      }

      // move next block on to find another free space
      nextBlockToPurchase = nextBlockToPurchase + 1;
    }

    // update last block once purchased
    lastPurchasedBlock = nextBlockToPurchase;

    // payments

    // 5% to foundation
    uint foundationShare = msg.value / 100 * foundationPercentage;
    foundationAddress.transfer(foundationShare);

    // artists sent the remaining value
    uint artistTotal = msg.value - foundationShare;
    artist.transfer(artistTotal);

    emit Purchased(msg.sender, _tokenId, blocksToPurchased, msg.value);
  }

  function purchaseBlock(uint256 _blocknumber, uint256 _tokenId) internal {
    // keep track of the token associated to the block
    blocknumberToTokenId[_blocknumber] = _tokenId;

    // Keep track of the blocks purchased by the token
    tokenIdToPurchasedBlocknumbers[_tokenId].push(_blocknumber);

    // Emit event for logging/tracking
    emit PurchaseBlock(msg.sender, _tokenId, getPurchasedBlockhash(_blocknumber), _blocknumber);
  }

  /**
   * @dev Attempts to work out the next block which will be funded
   */
  function nextPurchasableBlocknumber() public view returns (uint256 _nextFundedBlock) {
    if (block.number < lastPurchasedBlock) {
      return lastPurchasedBlock;
    }
    return block.number + 1;
  }

  /**
   * @dev Returns the blocks which the provided token has purchased
   */
  function blocknumbersOf(uint256 _tokenId) public view returns (uint256[] _blocks) {
    return tokenIdToPurchasedBlocknumbers[_tokenId];
  }

  /**
   * @dev Return token ID for the provided block or 0 when not found
   */
  function tokenIdOf(uint256 _blockNumber) public view returns (uint256 _tokenId) {
    return blocknumberToTokenId[_blockNumber];
  }

  /**
    * @dev Get the block hash the given block number
    * @param _blocknumber the block to generate hash for
    */
  function getPurchasedBlockhash(uint256 _blocknumber) public view returns (bytes32 _tokenHash) {
    // Do not allow this to be called for hashes which aren't purchased
    require(tokenIdOf(_blocknumber) != 0);

    uint256 tokenId = tokenIdOf(_blocknumber);
    return token.blockhashOf(tokenId);
  }

  /**
   * @dev Generates default block hash behaviour - helps with tests
   */
  function nativeBlockhash(uint256 _blocknumber) public view returns (bytes32 _tokenHash) {
    return blockhash(_blocknumber);
  }

  /**
   * @dev Generates a unique token hash for the token
   * @return the hash and its associated block
   */
  function nextHash() public view returns (bytes32 _tokenHash, uint256 _nextBlocknumber) {
    uint256 nextBlocknumber = block.number - 1;

    // if current block number has been allocated then use it
    if (tokenIdOf(nextBlocknumber) != 0) {
      return (getPurchasedBlockhash(nextBlocknumber), nextBlocknumber);
    }

    if (onlyShowPurchased) {
      return (0x0, nextBlocknumber);
    }

    // if no one own the current blockhash return current
    return (nativeBlockhash(nextBlocknumber), nextBlocknumber);
  }

  /**
   * @dev Returns blocknumber - helps with tests
   */
  function blocknumber() public view returns (uint256 _blockNumber) {
    return block.number;
  }

  /**
   * @dev Utility function for updating price per block
   * @param _priceInWei the price in wei
   */
  function setPricePerBlockInWei( uint256 _priceInWei) external onlyArtist {
    pricePerBlockInWei = _priceInWei;
  }

  /**
   * @dev Utility function for updating max blocks
   * @param _maxBlockPurchaseInOneGo max blocks per purchase
   */
  function setMaxBlockPurchaseInOneGo( uint256 _maxBlockPurchaseInOneGo) external onlyArtist {
    maxBlockPurchaseInOneGo = _maxBlockPurchaseInOneGo;
  }
  
  /**
   * @dev Utility function for updating min blocks
   * @param _minBlockPurchaseInOneGo min blocks per purchase
   */
  function setMinBlockPurchaseInOneGo( uint256 _minBlockPurchaseInOneGo) external onlyArtist {
    minBlockPurchaseInOneGo = _minBlockPurchaseInOneGo;
  }

  /**
 * @dev Utility function for only show purchased
 * @param _onlyShowPurchased flag for only showing purchased hashes
 */
  function setOnlyShowPurchased(bool _onlyShowPurchased) external onlyArtist {
    onlyShowPurchased = _onlyShowPurchased;
  }
}

