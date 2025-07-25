import React, { useState, useEffect, useCallback } from 'react';
import { Shuffle, RotateCcw, Play, Pause, Settings } from 'lucide-react';

const BlackjackTrainer = () => {
  // Game state
  const [deck, setDeck] = useState([]);
  const [playerHand, setPlayerHand] = useState([]);
  const [dealerHand, setDealerHand] = useState([]);
  const [gamePhase, setGamePhase] = useState('betting'); // betting, playing, dealer, finished
  const [gameResult, setGameResult] = useState('');
  const [balance, setBalance] = useState(1000);
  const [currentBet, setCurrentBet] = useState(10);
  const [lastWinAmount, setLastWinAmount] = useState(0);
  const [isDoubled, setIsDoubled] = useState(false);
  const [canSplit, setCanSplit] = useState(false);
  const [canDouble, setCanDouble] = useState(false);
  const [deckCount, setDeckCount] = useState(6);
  
  // Card counting state
  const [runningCount, setRunningCount] = useState(0);
  const [cardsDealt, setCardsDealt] = useState(0);
  const [mode, setMode] = useState('basic'); // basic, blackjack-counting, pure-counting
  const [autoPlay, setAutoPlay] = useState(false);
  
  // Pure counting mode state
  const [countingCards, setCountingCards] = useState([]);
  const [userCount, setUserCount] = useState('');
  const [showAnswer, setShowAnswer] = useState(false);
  const [countingScore, setCountingScore] = useState({ correct: 0, total: 0 });

  // Basic strategy chart (full version with doubling and splitting)
  const basicStrategy = {
    // [playerTotal][dealerCard] = action
    'hard': {
      21: ['S','S','S','S','S','S','S','S','S','S'],
      20: ['S','S','S','S','S','S','S','S','S','S'],
      19: ['S','S','S','S','S','S','S','S','S','S'],
      18: ['S','S','S','S','S','S','S','S','S','S'],
      17: ['S','S','S','S','S','S','S','S','S','S'],
      16: ['S','S','S','S','S','H','H','H','H','H'],
      15: ['S','S','S','S','S','H','H','H','H','H'],
      14: ['S','S','S','S','S','H','H','H','H','H'],
      13: ['S','S','S','S','S','H','H','H','H','H'],
      12: ['H','H','S','S','S','H','H','H','H','H'],
      11: ['D','D','D','D','D','D','D','D','D','H'],
      10: ['D','D','D','D','D','D','D','D','H','H'],
      9: ['H','D','D','D','D','H','H','H','H','H'],
      8: ['H','H','H','H','H','H','H','H','H','H'],
      7: ['H','H','H','H','H','H','H','H','H','H'],
      6: ['H','H','H','H','H','H','H','H','H','H'],
      5: ['H','H','H','H','H','H','H','H','H','H']
    },
    'soft': {
      'A9': ['S','S','S','S','S','S','S','S','S','S'],
      'A8': ['S','S','S','S','S','S','S','S','S','S'],
      'A7': ['S','D','D','D','D','S','S','H','H','H'],
      'A6': ['H','D','D','D','D','H','H','H','H','H'],
      'A5': ['H','H','D','D','D','H','H','H','H','H'],
      'A4': ['H','H','D','D','D','H','H','H','H','H'],
      'A3': ['H','H','H','D','D','H','H','H','H','H'],
      'A2': ['H','H','H','D','D','H','H','H','H','H']
    },
    'pairs': {
      'AA': ['SP','SP','SP','SP','SP','SP','SP','SP','SP','SP'],
      'TT': ['S','S','S','S','S','S','S','S','S','S'],
      '99': ['SP','SP','SP','SP','SP','S','SP','SP','S','S'],
      '88': ['SP','SP','SP','SP','SP','SP','SP','SP','SP','SP'],
      '77': ['SP','SP','SP','SP','SP','SP','H','H','H','H'],
      '66': ['SP','SP','SP','SP','SP','H','H','H','H','H'],
      '55': ['D','D','D','D','D','D','D','D','H','H'],
      '44': ['H','H','H','SP','SP','H','H','H','H','H'],
      '33': ['SP','SP','SP','SP','SP','SP','H','H','H','H'],
      '22': ['SP','SP','SP','SP','SP','SP','H','H','H','H']
    }
  };

  // Hi-Lo card counting values
  const cardValues = {
    'A': -1, 'K': -1, 'Q': -1, 'J': -1, '10': -1,
    '9': 0, '8': 0, '7': 0,
    '6': 1, '5': 1, '4': 1, '3': 1, '2': 1
  };

  // Create and shuffle deck
  const createDeck = useCallback(() => {
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const newDeck = [];
    
    // Create specified number of decks
    for (let d = 0; d < deckCount; d++) {
      for (let suit of suits) {
        for (let rank of ranks) {
          newDeck.push({ 
            rank, 
            suit, 
            value: getCardValue(rank),
            id: `${rank}${suit}${d}` // Add unique ID to prevent duplicates
          });
        }
      }
    }
    
    // Shuffle deck using Fisher-Yates algorithm
    for (let i = newDeck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
    }
    
    return newDeck;
  }, [deckCount]);

  const getCardValue = (rank) => {
    if (rank === 'A') return 11;
    if (['K', 'Q', 'J'].includes(rank)) return 10;
    return parseInt(rank);
  };

  const calculateHandValue = (hand) => {
    let value = 0;
    let aces = 0;
    
    for (let card of hand) {
      if (card.rank === 'A') {
        aces++;
        value += 11;
      } else {
        value += card.value;
      }
    }
    
    while (value > 21 && aces > 0) {
      value -= 10;
      aces--;
    }
    
    return value;
  };

  const updateCount = (card) => {
    if (mode === 'blackjack-counting' || mode === 'pure-counting') {
      const countValue = cardValues[card.rank] || 0;
      setRunningCount(prev => prev + countValue);
      setCardsDealt(prev => prev + 1);
    }
  };

  const getTrueCount = () => {
    const totalCards = deckCount * 52;
    const decksRemaining = (totalCards - cardsDealt) / 52;
    return Math.round(runningCount / decksRemaining);
  };

  // Pure counting mode functions
  const startCountingRound = () => {
    const numCards = Math.floor(Math.random() * 8) + 5; // 5-12 cards
    const newCountingCards = [];
    const tempDeck = [...deck];
    
    for (let i = 0; i < numCards && tempDeck.length > 0; i++) {
      const card = tempDeck.pop();
      newCountingCards.push(card);
      updateCount(card);
    }
    
    setDeck(tempDeck);
    setCountingCards(newCountingCards);
    setShowAnswer(false);
    setUserCount('');
  };

  const checkCountingAnswer = () => {
    const correctCount = runningCount;
    const userCountNum = parseInt(userCount) || 0;
    const isCorrect = userCountNum === correctCount;
    
    setCountingScore(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1
    }));
    
    setShowAnswer(true);
  };

  const resetCounting = () => {
    setDeck(createDeck());
    setRunningCount(0);
    setCardsDealt(0);
    setCountingCards([]);
    setUserCount('');
    setShowAnswer(false);
    setCountingScore({ correct: 0, total: 0 });
  };

  const getRecommendation = () => {
    if (playerHand.length === 0 || dealerHand.length === 0) return '';
    
    const playerValue = calculateHandValue(playerHand);
    const dealerCard = dealerHand[0].rank === 'A' ? 0 : 
                     ['K', 'Q', 'J'].includes(dealerHand[0].rank) ? 9 : 
                     parseInt(dealerHand[0].rank) - 2;
    
    if (playerValue > 21) return '';
    
    // Check for pairs
    if (playerHand.length === 2 && playerHand[0].rank === playerHand[1].rank) {
      const pairKey = playerHand[0].rank === 'A' ? 'AA' : 
                     ['K', 'Q', 'J', '10'].includes(playerHand[0].rank) ? 'TT' :
                     playerHand[0].rank + playerHand[0].rank;
      if (basicStrategy.pairs[pairKey]) {
        const action = basicStrategy.pairs[pairKey][dealerCard];
        return `${action} (Pair Strategy)`;
      }
    }
    
    // Check for soft hands
    const hasAce = playerHand.some(card => card.rank === 'A') && playerValue <= 21;
    if (hasAce && playerHand.length === 2) {
      const otherCard = playerHand.find(card => card.rank !== 'A');
      const softKey = 'A' + (otherCard.rank === 'A' ? '9' : otherCard.rank);
      if (basicStrategy.soft[softKey]) {
        const action = basicStrategy.soft[softKey][dealerCard];
        return `${action} (Soft Strategy)`;
      }
    }
    
    // Hard strategy
    if (basicStrategy.hard[playerValue]) {
      const action = basicStrategy.hard[playerValue][dealerCard];
      let recommendation = `${action} (Basic Strategy)`;
      
      // Add counting deviations for advanced mode
      if (mode === 'blackjack-counting') {
        const trueCount = getTrueCount();
        // Some common deviations
        if (playerValue === 16 && dealerCard === 8 && trueCount >= 4) {
          recommendation = 'S (Count Deviation: +4)';
        } else if (playerValue === 15 && dealerCard === 8 && trueCount >= 4) {
          recommendation = 'S (Count Deviation: +4)';
        } else if (playerValue === 12 && dealerCard === 1 && trueCount >= 3) {
          recommendation = 'S (Count Deviation: +3)';
        }
      }
      
      return recommendation;
    }
    
    return 'Hit';
  };

  const dealCard = (isDealer = false) => {
    if (deck.length === 0) return null;
    
    const newDeck = [...deck];
    const card = newDeck.pop();
    
    if (!card) return null;
    
    setDeck(newDeck);
    updateCount(card);
    
    if (isDealer) {
      setDealerHand(prev => {
        const newHand = [...prev, card];
        return newHand;
      });
    } else {
      setPlayerHand(prev => {
        const newHand = [...prev, card];
        return newHand;
      });
    }
    
    return card;
  };

  const startNewHand = () => {
    if (deck.length < 20) {
      // Reshuffle when deck gets low
      const newDeck = createDeck();
      setDeck(newDeck);
      setRunningCount(0);
      setCardsDealt(0);
    }
    
    setPlayerHand([]);
    setDealerHand([]);
    setGamePhase('playing');
    setGameResult('');
    setIsDoubled(false);
    setCanSplit(false);
    setCanDouble(false);
    
    // Deal initial cards with proper timing
    const newDeck = [...deck];
    
    // Deal player first card
    const playerCard1 = newDeck.pop();
    updateCount(playerCard1);
    
    // Deal dealer first card
    const dealerCard1 = newDeck.pop();
    updateCount(dealerCard1);
    
    // Deal player second card
    const playerCard2 = newDeck.pop();
    updateCount(playerCard2);
    
    // Update deck and hands
    setDeck(newDeck);
    setPlayerHand([playerCard1, playerCard2]);
    setDealerHand([dealerCard1]);
    
    // Check for available actions after hands are set
    setTimeout(() => {
      // Check if can split (same rank or both 10-value cards)
      const canSplitCards = (playerCard1.rank === playerCard2.rank) ||
        (['K','Q','J','10'].includes(playerCard1.rank) && ['K','Q','J','10'].includes(playerCard2.rank));
      
      setCanSplit(canSplitCards);
      setCanDouble(true); // Always can double on first two cards
    }, 100);
  };

  const hit = () => {
    const card = dealCard(false);
    setCanDouble(false); // Can't double after hitting
    setCanSplit(false);  // Can't split after hitting
    
    setTimeout(() => {
      const newValue = calculateHandValue([...playerHand, card]);
      if (newValue > 21) {
        setGamePhase('finished');
        setGameResult('Player Busts! Dealer Wins');
        const betAmount = isDoubled ? currentBet * 2 : currentBet;
        setLastWinAmount(-betAmount);
        setBalance(prev => prev - betAmount);
      }
    }, 100);
  };

  const stand = () => {
    setCanSplit(false);
    setCanDouble(false);
    // Start dealer play
    setTimeout(dealerPlay, 500);
  };

  const doubleDown = () => {
    setIsDoubled(true);
    setCanDouble(false);
    setCanSplit(false);
    
    const card = dealCard(false);
    
    setTimeout(() => {
      const newValue = calculateHandValue([...playerHand, card]);
      if (newValue > 21) {
        setGamePhase('finished');
        setGameResult('Player Busts! Dealer Wins');
        setLastWinAmount(-currentBet * 2);
        setBalance(prev => prev - currentBet * 2);
      } else {
        // After doubling, player must stand - start dealer play
        setTimeout(dealerPlay, 500);
      }
    }, 100);
  };

  const split = () => {
    // Simplified split - just play one hand
    setCanSplit(false);
    setCanDouble(true); // Can double after split
    
    // Remove one card and deal a new one
    const newPlayerHand = [playerHand[0]];
    setPlayerHand(newPlayerHand);
    
    setTimeout(() => {
      dealCard(false); // Deal new card to complete the hand
    }, 200);
  };

  const dealerPlay = () => {
    // Deal dealer's second card first
    dealCard(true);
    
    // Use a state-based approach for dealer logic
    setGamePhase('dealer-playing');
  };

  // Use useEffect to handle dealer play logic
  useEffect(() => {
    if (gamePhase === 'dealer-playing') {
      const dealerValue = calculateHandValue(dealerHand);
      
      if (dealerValue < 17) {
        // Dealer must hit
        const timer = setTimeout(() => {
          dealCard(true);
        }, 1000);
        return () => clearTimeout(timer);
      } else {
        // Dealer stands - game is over
        const timer = setTimeout(() => {
          setGamePhase('finished');
          determineWinner();
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [gamePhase, dealerHand]);

  const determineWinner = () => {
    const playerValue = calculateHandValue(playerHand);
    const dealerValue = calculateHandValue(dealerHand);
    const playerBlackjack = playerValue === 21 && playerHand.length === 2 && !isDoubled;
    const dealerBlackjack = dealerValue === 21 && dealerHand.length === 2;
    const betAmount = isDoubled ? currentBet * 2 : currentBet;
    
    let winAmount = 0;
    let result = '';
    
    if (playerValue > 21) {
      result = 'Player Busts! Dealer Wins';
      winAmount = -betAmount;
    } else if (dealerValue > 21) {
      result = 'Dealer Busts! Player Wins';
      winAmount = playerBlackjack ? currentBet * 1.5 : betAmount;
    } else if (playerBlackjack && !dealerBlackjack) {
      result = 'Blackjack! Player Wins';
      winAmount = currentBet * 1.5; // 3:2 payout (only on natural blackjack, not doubled)
    } else if (dealerBlackjack && !playerBlackjack) {
      result = 'Dealer Blackjack! Dealer Wins';
      winAmount = -betAmount;
    } else if (playerValue > dealerValue) {
      result = 'Player Wins!';
      winAmount = betAmount;
    } else if (dealerValue > playerValue) {
      result = 'Dealer Wins';
      winAmount = -betAmount;
    } else {
      result = 'Push (Tie)';
      winAmount = 0;
    }
    
    setGameResult(result);
    setLastWinAmount(winAmount);
    setBalance(prev => prev + winAmount);
  };

  // Initialize deck on component mount
  useEffect(() => {
    setDeck(createDeck());
  }, [createDeck]);

  // Auto-play functionality (only for blackjack modes)
  useEffect(() => {
    if (autoPlay && gamePhase === 'playing' && (mode === 'basic' || mode === 'blackjack-counting')) {
      const recommendation = getRecommendation();
      const action = recommendation.split(' ')[0];
      
      setTimeout(() => {
        if (action === 'H') hit();
        else if (action === 'S') stand();
        else if (action === 'D' && canDouble) doubleDown();
        else if (action === 'D' && !canDouble) hit(); // Hit if can't double
        else if (action === 'SP' && canSplit) split();
        else if (action === 'SP' && !canSplit) hit(); // Hit if can't split
      }, 1500);
    }
  }, [autoPlay, gamePhase, canDouble, canSplit, mode]);

  return (
    <div className="min-h-screen bg-green-900 text-white p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header with NEW SETTINGS */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold mb-6">Blackjack Card Counting Trainer</h1>
          
          {/* GAME SETTINGS PANEL - BRIGHT AND VISIBLE */}
          <div className="bg-yellow-400 bg-opacity-20 border-4 border-yellow-400 rounded-lg p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              
              {/* Training Mode */}
              <div>
                <label className="block text-yellow-300 font-bold mb-2">🎯 TRAINING MODE</label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className="w-full px-3 py-3 bg-gray-800 text-white rounded-lg border-2 border-yellow-400 text-lg font-bold"
                >
                  <option value="basic">🎯 Basic Strategy</option>
                  <option value="blackjack-counting">🃏 Blackjack + Counting</option>
                  <option value="pure-counting">🧮 Pure Counting Practice</option>
                </select>
              </div>

              {/* Number of Decks */}
              <div>
                <label className="block text-yellow-300 font-bold mb-2">🃏 DECK COUNT</label>
                <select
                  value={deckCount}
                  onChange={(e) => {
                    setDeckCount(parseInt(e.target.value));
                    setDeck(createDeck());
                    setRunningCount(0);
                    setCardsDealt(0);
                  }}
                  className="w-full px-3 py-3 bg-gray-800 text-white rounded-lg border-2 border-yellow-400 text-lg font-bold"
                >
                  <option value={1}>1 Deck</option>
                  <option value={2}>2 Decks</option>
                  <option value={4}>4 Decks</option>
                  <option value={6}>6 Decks</option>
                  <option value={8}>8 Decks</option>
                </select>
              </div>

              {/* Bet Amount */}
              {mode !== 'pure-counting' && (
                <div>
                  <label className="block text-yellow-300 font-bold mb-2">💰 BET AMOUNT</label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={currentBet}
                    onChange={(e) => setCurrentBet(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
                    className="w-full px-3 py-3 bg-gray-800 text-white rounded-lg border-2 border-yellow-400 text-lg font-bold text-center"
                  />
                </div>
              )}

              {/* Auto Play */}
              {(mode === 'basic' || mode === 'blackjack-counting') && (
                <div>
                  <label className="block text-yellow-300 font-bold mb-2">🤖 AUTO PLAY</label>
                  <button
                    onClick={() => setAutoPlay(!autoPlay)}
                    className={`w-full px-4 py-3 rounded-lg font-bold text-lg border-2 ${
                      autoPlay 
                        ? 'bg-red-600 border-red-400 text-white' 
                        : 'bg-green-600 border-green-400 text-white'
                    }`}
                  >
                    {autoPlay ? '⏸️ STOP' : '▶️ START'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Game Area */}
          <div className="lg:col-span-3">
            {mode === 'pure-counting' ? (
              /* Pure Counting Mode */
              <div>
                {/* Counting Stats */}
                <div className="bg-black bg-opacity-50 rounded-lg p-4 mb-6">
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold">{runningCount}</div>
                      <div className="text-sm">Running Count</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{getTrueCount()}</div>
                      <div className="text-sm">True Count</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{Math.round((deckCount * 52 - cardsDealt) / 52 * 10) / 10}</div>
                      <div className="text-sm">Decks Remaining</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-blue-400">
                        {countingScore.total > 0 ? `${Math.round(countingScore.correct / countingScore.total * 100)}%` : '0%'}
                      </div>
                      <div className="text-sm">Accuracy ({countingScore.correct}/{countingScore.total})</div>
                    </div>
                  </div>
                </div>

                {/* Cards Display */}
                <div className="mb-6">
                  <h3 className="text-xl mb-3">Cards Dealt</h3>
                  <div className="flex flex-wrap gap-2 min-h-[120px] bg-black bg-opacity-30 rounded-lg p-4">
                    {countingCards.map((card, index) => (
                      <div key={index} className="bg-white text-black p-3 rounded-lg text-center min-w-[60px]">
                        <div className="font-bold">{card.rank}</div>
                        <div className="text-xl">{card.suit}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Counting Input */}
                <div className="mb-6">
                  <div className="flex gap-4 items-end">
                    <div className="flex-1">
                      <label className="block text-sm font-medium mb-2">What's the running count?</label>
                      <input
                        type="number"
                        value={userCount}
                        onChange={(e) => setUserCount(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg text-xl text-center border border-gray-600 focus:border-blue-500"
                        placeholder="Enter count..."
                        disabled={countingCards.length === 0}
                      />
                    </div>
                    <button
                      onClick={checkCountingAnswer}
                      disabled={countingCards.length === 0 || userCount === '' || showAnswer}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg"
                    >
                      Check Answer
                    </button>
                  </div>
                  
                  {showAnswer && (
                    <div className="mt-4 p-4 rounded-lg bg-black bg-opacity-50">
                      <div className="text-lg">
                        <span className="font-semibold">Correct Answer: </span>
                        <span className="text-yellow-400">{runningCount}</span>
                      </div>
                      <div className="text-lg">
                        <span className="font-semibold">Your Answer: </span>
                        <span className={parseInt(userCount) === runningCount ? 'text-green-400' : 'text-red-400'}>
                          {userCount}
                        </span>
                      </div>
                      <div className="text-lg font-semibold">
                        {parseInt(userCount) === runningCount ? '✅ Correct!' : '❌ Incorrect'}
                      </div>
                    </div>
                  )}
                </div>

                {/* Counting Controls */}
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={startCountingRound}
                    disabled={deck.length < 15}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-6 py-3 rounded-lg flex items-center gap-2"
                  >
                    <Shuffle className="w-5 h-5" />
                    Deal New Cards
                  </button>
                  <button
                    onClick={resetCounting}
                    className="bg-gray-600 hover:bg-gray-700 px-6 py-3 rounded-lg flex items-center gap-2"
                  >
                    <RotateCcw className="w-5 h-5" />
                    Reset Counting
                  </button>
                </div>
              </div>
            ) : (
              /* Blackjack Modes */
              <div>
                {/* Balance Display */}
                <div className="bg-black bg-opacity-50 rounded-lg p-4 mb-6">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-green-400">${balance}</div>
                      <div className="text-sm">Balance</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-blue-400">
                        ${isDoubled ? currentBet * 2 : currentBet}
                        {isDoubled && <span className="text-sm ml-1">(2x)</span>}
                      </div>
                      <div className="text-sm">Current Bet</div>
                    </div>
                    <div>
                      <div className={`text-2xl font-bold ${lastWinAmount > 0 ? 'text-green-400' : lastWinAmount < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                        {lastWinAmount > 0 ? '+' : ''}${lastWinAmount}
                      </div>
                      <div className="text-sm">Last Hand</div>
                    </div>
                  </div>
                </div>

                {/* Card Counting Display */}
                {mode === 'blackjack-counting' && (
                  <div className="bg-black bg-opacity-50 rounded-lg p-4 mb-6">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold">{runningCount}</div>
                        <div className="text-sm">Running Count</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{getTrueCount()}</div>
                        <div className="text-sm">True Count</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{Math.round((deckCount * 52 - cardsDealt) / 52 * 10) / 10}</div>
                        <div className="text-sm">Decks Remaining</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Dealer Hand */}
                <div className="mb-8">
                  <h3 className="text-xl mb-3">Dealer ({calculateHandValue(dealerHand)})</h3>
                  <div className="flex gap-2">
                    {dealerHand.map((card, index) => (
                      <div key={index} className="bg-white text-black p-3 rounded-lg text-center min-w-[60px]">
                        <div className="font-bold">{card.rank}</div>
                        <div className="text-xl">{card.suit}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Player Hand */}
                <div className="mb-8">
                  <h3 className="text-xl mb-3">Player ({calculateHandValue(playerHand)})</h3>
                  <div className="flex gap-2">
                    {playerHand.map((card, index) => (
                      <div key={index} className="bg-white text-black p-3 rounded-lg text-center min-w-[60px]">
                        <div className="font-bold">{card.rank}</div>
                        <div className="text-xl">{card.suit}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Game Controls */}
                <div className="flex gap-4 justify-center mb-6 flex-wrap">
                  {gamePhase === 'betting' || gamePhase === 'finished' ? (
                    <button
                      onClick={startNewHand}
                      className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg flex items-center gap-2"
                    >
                      <Shuffle className="w-5 h-5" />
                      Deal New Hand
                    </button>
                  ) : gamePhase === 'playing' ? (
                    <>
                      <button
                        onClick={hit}
                        className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-lg"
                      >
                        Hit
                      </button>
                      <button
                        onClick={stand}
                        className="bg-yellow-600 hover:bg-yellow-700 px-6 py-3 rounded-lg"
                      >
                        Stand
                      </button>
                      {canDouble && (
                        <button
                          onClick={doubleDown}
                          className="bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-lg"
                        >
                          Double Down
                        </button>
                      )}
                      {canSplit && (
                        <button
                          onClick={split}
                          className="bg-orange-600 hover:bg-orange-700 px-6 py-3 rounded-lg"
                        >
                          Split
                        </button>
                      )}
                    </>
                  ) : gamePhase === 'dealer-playing' ? (
                    <div className="text-center text-xl">Dealer is playing...</div>
                  ) : null}
                  
                  <button
                    onClick={() => {
                      const newDeck = createDeck();
                      setDeck(newDeck);
                      setRunningCount(0);
                      setCardsDealt(0);
                      setPlayerHand([]);
                      setDealerHand([]);
                      setGamePhase('betting');
                      setGameResult('');
                      setBalance(1000);
                      setLastWinAmount(0);
                      setIsDoubled(false);
                      setCanSplit(false);
                      setCanDouble(false);
                    }}
                    className="bg-gray-600 hover:bg-gray-700 px-6 py-3 rounded-lg flex items-center gap-2"
                  >
                    <RotateCcw className="w-5 h-5" />
                    Reset Game
                  </button>
                </div>

                {/* Game Result */}
                {gameResult && (
                  <div className="text-center text-2xl font-bold mb-6 p-4 bg-black bg-opacity-50 rounded-lg">
                    {gameResult}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Strategy Panel */}
          <div className="bg-black bg-opacity-50 rounded-lg p-4">
            {mode === 'pure-counting' ? (
              /* Pure Counting Panel */
              <div>
                <h3 className="text-xl font-bold mb-4">Counting Practice</h3>
                
                <div className="mb-4">
                  <h4 className="font-semibold mb-2">Hi-Lo Values:</h4>
                  <div className="text-sm space-y-1">
                    <div><span className="font-bold text-green-400">+1:</span> 2,3,4,5,6</div>
                    <div><span className="font-bold text-gray-400">0:</span> 7,8,9</div>
                    <div><span className="font-bold text-red-400">-1:</span> 10,J,Q,K,A</div>
                  </div>
                </div>

                <div className="mb-4">
                  <h4 className="font-semibold mb-2">Tips:</h4>
                  <div className="text-sm space-y-1">
                    <div>• Count each card as it appears</div>
                    <div>• Keep a running total in your head</div>
                    <div>• Practice until it's automatic</div>
                    <div>• Higher counts = better odds</div>
                  </div>
                </div>

                <div className="p-3 bg-gray-800 rounded text-sm">
                  <div className="font-bold mb-2">Progress:</div>
                  <div>Total Rounds: {countingScore.total}</div>
                  <div>Correct: {countingScore.correct}</div>
                  <div>Accuracy: {countingScore.total > 0 ? `${Math.round(countingScore.correct / countingScore.total * 100)}%` : '0%'}</div>
                </div>
              </div>
            ) : (
              /* Strategy Panel for Blackjack Modes */
              <div>
                <h3 className="text-xl font-bold mb-4">Strategy Helper</h3>
                
                {/* Current Recommendation */}
                <div className="mb-6">
                  <h4 className="font-semibold mb-2">Recommended Action:</h4>
                  <div className="bg-blue-900 p-3 rounded text-center font-bold">
                    {getRecommendation() || 'Deal cards to start'}
                  </div>
                </div>

                {/* Legend */}
                <div className="mb-4">
                  <h4 className="font-semibold mb-2">Legend:</h4>
                  <div className="text-sm space-y-1">
                    <div><span className="font-bold">H</span> - Hit</div>
                    <div><span className="font-bold">S</span> - Stand</div>
                    <div><span className="font-bold">D</span> - Double Down</div>
                    <div><span className="font-bold">SP</span> - Split</div>
                  </div>
                </div>

                {/* Card Counting Info */}
                {mode === 'blackjack-counting' && (
                  <div>
                    <h4 className="font-semibold mb-2">Hi-Lo Values:</h4>
                    <div className="text-sm space-y-1">
                      <div><span className="font-bold">+1:</span> 2,3,4,5,6</div>
                      <div><span className="font-bold">0:</span> 7,8,9</div>
                      <div><span className="font-bold">-1:</span> 10,J,Q,K,A</div>
                    </div>
                    <div className="mt-3 p-2 bg-gray-800 rounded text-xs">
                      <div className="font-bold">Betting Guide:</div>
                      <div>True Count +2: Bet 2 units</div>
                      <div>True Count +3: Bet 4 units</div>
                      <div>True Count +4: Bet 8 units</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlackjackTrainer;