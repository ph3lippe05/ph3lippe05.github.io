/**
 * 21CHIPS - Blackjack Game State & Rule Engine
 * Authoritative game rules and settlement calculation executed by the Dealer.
 */

class TableState {
  constructor(config = {}) {
    this.startingChips = config.startingChips || 1000;
    this.minBet = config.minBet || 10;
    this.maxBet = config.maxBet || 500;
    this.bjPayoutMultiplier = config.bjPayout || 1.5; // 3:2 is 1.5, 6:5 is 1.2
    
    this.phase = 'BETTING'; // 'BETTING' | 'ACTION' | 'SETTLING' | 'ROUND_OVER'
    this.roundNum = 1;
    this.players = new Map(); // playerId -> PlayerData
    this.stats = []; // History of hands & rounds
  }

  /**
   * Register or restore a player
   */
  addOrUpdatePlayer(playerData, peerId) {
    const existing = this.players.get(playerData.id);
    if (existing) {
      existing.peerId = peerId;
      existing.online = true;
      existing.name = playerData.name || existing.name;
      existing.avatar = playerData.avatar || existing.avatar;
      return existing;
    }

    const newPlayer = {
      id: playerData.id,
      peerId: peerId,
      name: playerData.name,
      avatar: playerData.avatar || '😎',
      chips: this.startingChips,
      initialChips: this.startingChips,
      online: true,
      hands: [
        {
          id: 1,
          bet: 0,
          isDouble: false,
          settled: null, // null | 'WIN' | 'BJ' | 'LOSE' | 'PUSH'
          payout: 0
        }
      ],
      isSplit: false
    };

    this.players.set(playerData.id, newPlayer);
    return newPlayer;
  }

  setPlayerOnline(peerId, isOnline) {
    for (const [_, player] of this.players) {
      if (player.peerId === peerId) {
        player.online = isOnline;
        break;
      }
    }
  }

  getPlayerByPeerId(peerId) {
    for (const [_, player] of this.players) {
      if (player.peerId === peerId) return player;
    }
    return null;
  }

  /**
   * Player places or modifies their initial bet
   */
  placeBet(playerId, amount) {
    if (this.phase !== 'BETTING') {
      return { success: false, message: 'Zakłady są obecnie zablokowane!' };
    }

    const player = this.players.get(playerId);
    if (!player) return { success: false, message: 'Nie znaleziono gracza' };

    // Amount validation
    if (amount < 0) return { success: false, message: 'Nieprawidłowa kwota' };
    
    // Check if amount exceeds player's available chips + currently placed bet
    const currentBet = player.hands[0].bet;
    const totalAvailable = player.chips + currentBet;

    if (amount > totalAvailable) {
      return { success: false, message: 'Brak wystarczającej liczby żetonów!' };
    }

    if (amount > 0 && amount < this.minBet) {
      return { success: false, message: `Minimalny zakład wynosi ${this.minBet}` };
    }

    if (amount > this.maxBet) {
      return { success: false, message: `Maksymalny zakład wynosi ${this.maxBet}` };
    }

    // Apply bet
    player.chips = totalAvailable - amount;
    player.hands[0].bet = amount;
    player.hands[0].settled = null;
    player.hands[0].isDouble = false;
    player.isSplit = false;

    return { success: true, player };
  }

  /**
   * Lock Bets and move to Action / Dealing Phase
   */
  lockBets() {
    // Only proceed if at least one player has placed a bet
    let activeBetsCount = 0;
    this.players.forEach(p => {
      if (p.hands[0] && p.hands[0].bet > 0) activeBetsCount++;
    });

    this.phase = 'ACTION';
    return { success: true, activeBetsCount };
  }

  /**
   * Double Down on a specific hand
   */
  doubleDown(playerId, handIndex = 0) {
    const player = this.players.get(playerId);
    if (!player) return { success: false, message: 'Nie znaleziono gracza' };

    const hand = player.hands[handIndex];
    if (!hand || hand.bet <= 0) {
      return { success: false, message: 'Brak aktywnego zakładu do podwojenia' };
    }

    if (hand.isDouble) {
      return { success: false, message: 'Zakład został już podwojony' };
    }

    if (player.chips < hand.bet) {
      return { success: false, message: 'Za mało żetonów na Double Down!' };
    }

    // Deduct additional bet from balance
    player.chips -= hand.bet;
    hand.bet = hand.bet * 2;
    hand.isDouble = true;

    return { success: true, player, hand };
  }

  /**
   * Split player hand into two independent hands
   */
  splitHand(playerId) {
    const player = this.players.get(playerId);
    if (!player) return { success: false, message: 'Nie znaleziono gracza' };

    if (player.isSplit) {
      return { success: false, message: 'Można podzielić rękę tylko raz' };
    }

    const firstHand = player.hands[0];
    if (!firstHand || firstHand.bet <= 0) {
      return { success: false, message: 'Brak zakładu' };
    }

    const splitBetCost = firstHand.bet;
    if (player.chips < splitBetCost) {
      return { success: false, message: 'Za mało żetonów na Split!' };
    }

    // Deduct bet for hand 2
    player.chips -= splitBetCost;
    player.isSplit = true;

    // Create Hand 2 with equal bet
    player.hands.push({
      id: 2,
      bet: splitBetCost,
      isDouble: false,
      settled: null,
      payout: 0
    });

    return { success: true, player };
  }

  /**
   * Settle a hand outcome: WIN | BJ | LOSE | PUSH
   */
  settleHand(playerId, handIndex, outcome) {
    const player = this.players.get(playerId);
    if (!player) return { success: false, message: 'Nie znaleziono gracza' };

    const hand = player.hands[handIndex];
    if (!hand || hand.bet <= 0) {
      return { success: false, message: 'Brak zakładu do rozliczenia' };
    }

    // If hand was already settled, revert previous payout first
    if (hand.settled && hand.payout > 0) {
      player.chips -= hand.payout;
    }

    hand.settled = outcome;
    let payout = 0;

    switch (outcome) {
      case 'WIN': // 1:1 payout (return bet + 1x profit)
        payout = hand.bet * 2;
        break;

      case 'BJ': // 3:2 payout (return bet + 1.5x profit)
        payout = Math.floor(hand.bet + (hand.bet * this.bjPayoutMultiplier));
        break;

      case 'PUSH': // Tie (return original bet)
        payout = hand.bet;
        break;

      case 'LOSE': // Dealer wins (player gets 0)
        payout = 0;
        break;
    }

    hand.payout = payout;
    player.chips += payout;

    // Check if all active players and hands are settled
    this.checkIfRoundOver();

    return { success: true, player, hand, payout };
  }

  /**
   * Settle all hands with a global dealer outcome
   */
  settleGlobalDealerBust() {
    this.players.forEach(p => {
      p.hands.forEach((h, idx) => {
        if (h.bet > 0 && !h.settled) {
          this.settleHand(p.id, idx, 'WIN');
        }
      });
    });
  }

  settleGlobalDealerBlackjack() {
    this.players.forEach(p => {
      p.hands.forEach((h, idx) => {
        if (h.bet > 0 && !h.settled) {
          // If player didn't push BJ, they lose
          this.settleHand(p.id, idx, 'LOSE');
        }
      });
    });
  }

  checkIfRoundOver() {
    let allSettled = true;
    for (const [_, p] of this.players) {
      for (const h of p.hands) {
        if (h.bet > 0 && !h.settled) {
          allSettled = false;
          break;
        }
      }
    }

    if (allSettled) {
      this.phase = 'ROUND_OVER';
    }
  }

  /**
   * Start New Round
   */
  startNewRound() {
    this.roundNum++;
    this.phase = 'BETTING';

    this.players.forEach(player => {
      player.isSplit = false;
      player.hands = [
        {
          id: 1,
          bet: 0,
          isDouble: false,
          settled: null,
          payout: 0
        }
      ];
    });

    return { success: true, roundNum: this.roundNum };
  }

  /**
   * Adjust player chips (Rebuy / Admin edit)
   */
  setPlayerChips(playerId, newChips) {
    const player = this.players.get(playerId);
    if (!player) return false;
    player.chips = Math.max(0, parseInt(newChips, 10));
    return true;
  }

  addPlayerChips(playerId, amount) {
    const player = this.players.get(playerId);
    if (!player) return false;
    player.chips += parseInt(amount, 10);
    return true;
  }

  removePlayer(playerId) {
    return this.players.delete(playerId);
  }

  /**
   * Serialize state to JSON for network broadcast
   */
  serialize() {
    return {
      phase: this.phase,
      roundNum: this.roundNum,
      minBet: this.minBet,
      maxBet: this.maxBet,
      bjPayout: this.bjPayoutMultiplier,
      players: Array.from(this.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        chips: p.chips,
        online: p.online,
        isSplit: p.isSplit,
        hands: p.hands
      }))
    };
  }
}

window.TableState = TableState;
