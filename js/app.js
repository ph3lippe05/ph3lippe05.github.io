/**
 * 21CHIPS - Main Application Controller
 * Handles UI interactions, screen routing, real-time updates and QR sharing.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Application State
  const App = {
    role: null, // 'DEALER' | 'PLAYER'
    roomCode: null,
    table: null, // Host TableState instance
    playerData: {
      id: localStorage.getItem('bj_player_id') || ('pl_' + Math.random().toString(36).substring(2, 9)),
      name: localStorage.getItem('bj_player_name') || '',
      avatar: localStorage.getItem('bj_player_avatar') || '😎',
      chips: 0,
      activeBet: 0,
      lastBet: 0,
      tentativeBet: 0,
      isSplit: false
    },
    tableStateCache: null,
    qrCodeInstance: null,
    selectedPlayerForRebuy: null,
    theme: localStorage.getItem('bj_theme') || 'green',
    dealerLayout: localStorage.getItem('bj_dealer_layout') || 'semicircle'
  };

  // Persist player ID
  localStorage.setItem('bj_player_id', App.playerData.id);

  // Theme Management
  function setTheme(themeName) {
    const validThemes = ['green', 'purple', 'red', 'blue'];
    if (!validThemes.includes(themeName)) themeName = 'green';
    App.theme = themeName;
    document.body.setAttribute('data-theme', themeName);
    localStorage.setItem('bj_theme', themeName);

    // Update active state in settings modal
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === themeName);
    });
  }

  // Dealer Table Layout Management
  function setDealerLayout(layout) {
    if (layout !== 'semicircle' && layout !== 'grid') layout = 'semicircle';
    App.dealerLayout = layout;
    localStorage.setItem('bj_dealer_layout', layout);

    const container = document.getElementById('table-players-container');
    const playersListEl = document.getElementById('dealer-players-list');
    const layoutToggleBtn = document.getElementById('btn-toggle-layout');
    const layoutIcon = document.getElementById('layout-toggle-icon');
    const layoutText = document.getElementById('layout-toggle-text');

    if (container) {
      container.classList.toggle('layout-semicircle', layout === 'semicircle');
      container.classList.toggle('layout-grid', layout === 'grid');
    }

    if (playersListEl) {
      playersListEl.classList.toggle('dealer-players-semicircle', layout === 'semicircle');
      playersListEl.classList.toggle('dealer-players-grid', layout === 'grid');
    }

    if (layoutIcon && layoutText) {
      if (layout === 'semicircle') {
        layoutIcon.textContent = '🎪';
        layoutText.textContent = 'Półkole';
        if (layoutToggleBtn) layoutToggleBtn.title = 'Przełącz na widok siatki kafelków';
      } else {
        layoutIcon.textContent = '🔲';
        layoutText.textContent = 'Siatka';
        if (layoutToggleBtn) layoutToggleBtn.title = 'Przełącz na widok półkola stołu';
      }
    }

    // Update active button in settings modal
    document.querySelectorAll('#layout-selector .layout-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.layout === layout);
    });

    if (App.role === 'DEALER' && App.table) {
      renderDealerTable();
    }
  }

  // Apply saved theme and layout on startup
  setTheme(App.theme);
  setDealerLayout(App.dealerLayout);

  // DOM Elements
  const screens = {
    welcome: document.getElementById('screen-welcome'),
    create: document.getElementById('screen-create'),
    join: document.getElementById('screen-join'),
    dealer: document.getElementById('screen-dealer'),
    player: document.getElementById('screen-player')
  };

  // Toast Helper
  function showToast(message, duration = 3000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, duration);
  }

  // Switch Screen Helper
  function switchScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    if (screens[screenName]) {
      screens[screenName].classList.add('active');
      window.scrollTo(0, 0);
    }
  }

  // ==========================================================================
  // URL PARAMETERS & AUTO-JOIN DETECTION
  // ==========================================================================
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get('room');

  if (roomParam) {
    // Automatically prepare player join screen
    switchScreen('join');
    const roomInput = document.getElementById('input-room-code');
    if (roomInput) {
      roomInput.value = roomParam.toUpperCase();
    }
    const nameInput = document.getElementById('input-player-name');
    if (nameInput && App.playerData.name) {
      nameInput.value = App.playerData.name;
    }
  }

  // Navigation Buttons
  document.getElementById('btn-show-create').addEventListener('click', () => {
    window.sounds.playClick();
    switchScreen('create');
  });

  document.getElementById('btn-show-join').addEventListener('click', () => {
    window.sounds.playClick();
    switchScreen('join');
    const nameInput = document.getElementById('input-player-name');
    if (nameInput && App.playerData.name) {
      nameInput.value = App.playerData.name;
    }
  });

  document.querySelectorAll('.btn-back').forEach(btn => {
    btn.addEventListener('click', () => {
      window.sounds.playClick();
      switchScreen(btn.dataset.target.replace('screen-', ''));
    });
  });

  // Stepper buttons in room creation
  document.querySelectorAll('.btn-step').forEach(btn => {
    btn.addEventListener('click', () => {
      window.sounds.playClick();
      const targetInput = document.getElementById(btn.dataset.target);
      const step = parseInt(btn.dataset.step, 10);
      let val = parseInt(targetInput.value, 10) || 0;
      val = Math.max(parseInt(targetInput.min, 10) || 0, val + step);
      targetInput.value = val;
    });
  });

  // Avatar Selection
  const avatarButtons = document.querySelectorAll('.avatar-btn');
  avatarButtons.forEach(btn => {
    if (btn.dataset.avatar === App.playerData.avatar) {
      avatarButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }
    btn.addEventListener('click', () => {
      window.sounds.playClick();
      avatarButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      App.playerData.avatar = btn.dataset.avatar;
      localStorage.setItem('bj_player_avatar', App.playerData.avatar);
    });
  });

  // ==========================================================================
  // DEALER: CREATE ROOM
  // ==========================================================================
  const formCreate = document.getElementById('form-create-room');
  formCreate.addEventListener('submit', async (e) => {
    e.preventDefault();
    window.sounds.playClick();

    const startingChips = parseInt(document.getElementById('input-starting-chips').value, 10);
    const minBet = parseInt(document.getElementById('input-min-bet').value, 10);
    const maxBet = parseInt(document.getElementById('input-max-bet').value, 10);
    const bjPayout = parseFloat(document.querySelector('input[name="bj-payout"]:checked').value);

    // Generate readable 4-digit room code
    const roomCode = Math.floor(1000 + Math.random() * 9000).toString();
    App.roomCode = roomCode;
    App.role = 'DEALER';

    // Initialize Host Table State
    App.table = new TableState({
      startingChips,
      minBet,
      maxBet,
      bjPayout
    });

    try {
      showToast('Inicjalizacja stołu P2P...');
      await window.network.initHost(roomCode);

      // UI updates
      document.getElementById('dealer-room-display').textContent = roomCode;
      setupQRCode(roomCode);
      renderDealerTable();
      switchScreen('dealer');
      showToast(`Stół #${roomCode} utworzony pomyślnie!`);
    } catch (err) {
      showToast('Błąd tworzenia stołu. Spróbuj ponownie.');
    }
  });

  // QR Code Generation
  function setupQRCode(roomCode) {
    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
    document.getElementById('modal-room-code').textContent = roomCode;
    document.getElementById('input-share-url').value = shareUrl;

    const qrContainer = document.getElementById('qr-code-canvas');
    qrContainer.innerHTML = '';

    if (window.QRCode) {
      App.qrCodeInstance = new QRCode(qrContainer, {
        text: shareUrl,
        width: 190,
        height: 190,
        colorDark: '#072214',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    }
  }

  // Copy share URL
  document.getElementById('btn-copy-url').addEventListener('click', () => {
    window.sounds.playClick();
    const input = document.getElementById('input-share-url');
    input.select();
    navigator.clipboard.writeText(input.value).then(() => {
      showToast('Skopiowano link do schowka!');
    });
  });

  // Modal QR Open / Close
  document.getElementById('btn-open-qr').addEventListener('click', () => {
    window.sounds.playClick();
    document.getElementById('modal-qr').classList.remove('hidden');
  });

  document.getElementById('btn-close-qr').addEventListener('click', () => {
    window.sounds.playClick();
    document.getElementById('modal-qr').classList.add('hidden');
  });

  // Toggle Sound Button
  document.getElementById('btn-toggle-sound').addEventListener('click', (e) => {
    const isAudioOn = window.sounds.toggleMute();
    e.currentTarget.textContent = isAudioOn ? '🔊' : '🔇';
    showToast(isAudioOn ? 'Dźwięk włączony' : 'Dźwięk wyciszony');
  });

  // ==========================================================================
  // HOST NETWORK EVENTS
  // ==========================================================================
  window.network.on('message_received', ({ peerId, data }) => {
    if (App.role !== 'DEALER' || !App.table) return;

    switch (data.type) {
      case 'JOIN': {
        const player = App.table.addOrUpdatePlayer({
          id: data.playerId,
          name: data.name,
          avatar: data.avatar
        }, peerId);

        showToast(`${player.avatar} ${player.name} dołączył do stołu`);
        window.sounds.playCard();

        // Send Welcome & initial table state
        window.network.sendToClient(peerId, {
          type: 'WELCOME',
          tableConfig: {
            startingChips: App.table.startingChips,
            minBet: App.table.minBet,
            maxBet: App.table.maxBet,
            bjPayout: App.table.bjPayoutMultiplier
          },
          player: player,
          tableState: App.table.serialize()
        });

        broadcastTableState();
        renderDealerTable();
        break;
      }

      case 'PLACE_BET': {
        const result = App.table.placeBet(data.playerId, data.amount);
        if (result.success) {
          window.sounds.playChip();
          broadcastTableState();
          renderDealerTable();
        } else {
          window.network.sendToClient(peerId, {
            type: 'BET_ERROR',
            message: result.message
          });
        }
        break;
      }

      case 'REQUEST_DOUBLE': {
        const result = App.table.doubleDown(data.playerId, data.handIndex || 0);
        if (result.success) {
          window.sounds.playChip();
          showToast(`⚡ ${result.player.name} podwoił zakład (Double Down)!`);
          broadcastTableState();
          renderDealerTable();
        } else {
          window.network.sendToClient(peerId, {
            type: 'BET_ERROR',
            message: result.message
          });
        }
        break;
      }

      case 'REQUEST_SPLIT': {
        const result = App.table.splitHand(data.playerId);
        if (result.success) {
          window.sounds.playChip();
          showToast(`✂️ ${result.player.name} podzielił rękę (Split)!`);
          broadcastTableState();
          renderDealerTable();
        } else {
          window.network.sendToClient(peerId, {
            type: 'BET_ERROR',
            message: result.message
          });
        }
        break;
      }
    }
  });

  window.network.on('player_disconnected', ({ peerId }) => {
    if (App.role === 'DEALER' && App.table) {
      App.table.setPlayerOnline(peerId, false);
      renderDealerTable();
    }
  });

  function broadcastTableState() {
    if (App.role !== 'DEALER' || !App.table) return;
    const serialized = App.table.serialize();
    window.network.broadcast({
      type: 'TABLE_UPDATE',
      tableState: serialized
    });
  }

  // ==========================================================================
  // DEALER ROUND CONTROLS
  // ==========================================================================
  const btnLockBets = document.getElementById('btn-lock-bets');
  const btnNewRound = document.getElementById('btn-new-round');

  btnLockBets.addEventListener('click', () => {
    if (App.role !== 'DEALER' || !App.table) return;
    window.sounds.playCard();

    App.table.lockBets();
    broadcastTableState();
    renderDealerTable();
    showToast('🔒 Zakłady zablokowane. Rozdaj karty fizyczne!');
  });

  btnNewRound.addEventListener('click', () => {
    if (App.role !== 'DEALER' || !App.table) return;
    window.sounds.playCard();

    App.table.startNewRound();
    broadcastTableState();
    renderDealerTable();
    showToast(`✨ Nowe rozdanie #${App.table.roundNum}! Zakłady otwarte.`);
  });

  // Global Dealer Outcome Actions
  document.getElementById('btn-quick-dealer-bj').addEventListener('click', () => {
    if (App.role !== 'DEALER' || !App.table) return;
    if (confirm('Czy na pewno krupier ma Blackjacka? Wszyscy gracze przegrają swoje zakłady.')) {
      window.sounds.playLose();
      App.table.settleGlobalDealerBlackjack();
      broadcastTableState();
      renderDealerTable();
      showToast('Krupier Blackjack - zakłady rozliczone');
    }
  });

  document.getElementById('btn-quick-dealer-bust').addEventListener('click', () => {
    if (App.role !== 'DEALER' || !App.table) return;
    if (confirm('Krupier ma Furę (Bust)? Wszyscy gracze w grze wygrywają 1:1.')) {
      window.sounds.playWin();
      App.table.settleGlobalDealerBust();
      broadcastTableState();
      renderDealerTable();
      showToast('Krupier Bust - gracze wygrali!');
    }
  });

  // Render Dealer Table Cards
  function renderDealerTable() {
    if (App.role !== 'DEALER' || !App.table) return;

    // Phase Badge
    const phaseBadge = document.getElementById('dealer-phase-badge');
    const roundNumEl = document.getElementById('dealer-round-num');
    roundNumEl.textContent = App.table.roundNum;

    if (App.table.phase === 'BETTING') {
      phaseBadge.textContent = 'FAZA: ZAKŁADY';
      phaseBadge.style.color = 'var(--gold-primary)';
      phaseBadge.style.borderColor = 'rgba(229, 185, 76, 0.4)';
      btnLockBets.disabled = false;
      btnNewRound.disabled = true;
    } else if (App.table.phase === 'ACTION') {
      phaseBadge.textContent = 'FAZA: ROZGRYWKA';
      phaseBadge.style.color = '#38bdf8';
      phaseBadge.style.borderColor = 'rgba(56, 189, 248, 0.4)';
      btnLockBets.disabled = true;
      btnNewRound.disabled = true;
    } else if (App.table.phase === 'ROUND_OVER') {
      phaseBadge.textContent = 'FAZA: ROZLICZONO';
      phaseBadge.style.color = 'var(--color-win)';
      phaseBadge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
      btnLockBets.disabled = true;
      btnNewRound.disabled = false;
    }

    const container = document.getElementById('dealer-players-list');
    const playersList = Array.from(App.table.players.values());

    if (playersList.length === 0) {
      container.innerHTML = `
        <div class="no-players-placeholder">
          <div class="pulse-ring"></div>
          <p>Oczekiwanie na graczy...</p>
          <p class="sub-text">Pokaż kod QR lub podaj kod pokoju: <strong>${App.roomCode}</strong></p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';

    playersList.forEach((player, pIdx) => {
      const card = document.createElement('div');
      const hasBet = player.hands.some(h => h.bet > 0);
      const isSemicircle = App.dealerLayout === 'semicircle';
      card.className = `player-card ${hasBet ? 'has-bet' : ''} ${isSemicircle ? 'player-card-semicircle' : ''}`;

      // Calculate arc positioning for semicircle mode
      if (isSemicircle) {
        const N = playersList.length;
        let angle = 90;
        if (N === 1) {
          angle = 90;
        } else if (N === 2) {
          angle = pIdx === 0 ? 55 : 125;
        } else if (N === 3) {
          angle = 45 + pIdx * 45;
        } else if (N === 4) {
          angle = 35 + pIdx * 36.6;
        } else {
          const startAngle = 22;
          const endAngle = 158;
          angle = startAngle + (pIdx * (endAngle - startAngle)) / (N - 1);
        }

        const rad = (angle * Math.PI) / 180;
        const posX = 50 - Math.cos(rad) * 38;
        const posY = 18 + Math.sin(rad) * 58;
        const rot = (angle - 90) * 0.22;

        card.style.setProperty('--arc-x', `${posX.toFixed(2)}%`);
        card.style.setProperty('--arc-y', `${posY.toFixed(2)}%`);
        card.style.setProperty('--arc-rot', `${rot.toFixed(2)}deg`);
        card.dataset.seatIndex = (pIdx + 1).toString();
      }

      // Card Header
      const header = document.createElement('div');
      header.className = 'player-card-header';
      header.innerHTML = `
        <div class="player-identity">
          <div class="player-avatar">${player.avatar}</div>
          <div class="player-details">
            <span class="player-seat-tag">Miejsce #${pIdx + 1}</span>
            <h4>
              ${escapeHtml(player.name)}
              <span class="player-connection-dot ${player.online ? '' : 'offline'}" title="${player.online ? 'Online' : 'Offline'}"></span>
            </h4>
            <span class="player-card-chips">🟡 ${player.chips.toLocaleString()}</span>
          </div>
        </div>
        <button class="btn-card-menu" title="Zarządzaj żetonami" data-player-id="${player.id}">⚙️</button>
      `;

      // Rebuy / Edit click
      header.querySelector('.btn-card-menu').addEventListener('click', () => {
        openRebuyModal(player);
      });

      card.appendChild(header);

      // Hands Container
      const handsWrap = document.createElement('div');
      handsWrap.className = 'player-hands-wrap';

      player.hands.forEach((hand, hIdx) => {
        const handBox = document.createElement('div');
        handBox.className = `hand-box ${player.isSplit ? 'split-hand' : ''}`;

        const handLabel = player.isSplit ? `RĘKA ${hIdx + 1}` : 'ZAKŁAD';
        const betFormatted = hand.bet > 0 ? `${hand.bet.toLocaleString()} żetonów` : 'Brak zakładu';

        handBox.innerHTML = `
          <div class="hand-header-info">
            <span class="hand-name">${handLabel}</span>
            <span class="hand-bet-badge">${betFormatted}</span>
          </div>
          <div class="hand-special-tags">
            ${hand.isDouble ? '<span class="tag-badge tag-double">DOUBLE x2</span>' : ''}
            ${player.isSplit ? '<span class="tag-badge tag-split">SPLIT</span>' : ''}
          </div>
        `;

        // If hand has bet, render settlement options
        if (hand.bet > 0) {
          if (hand.settled) {
            // Already Settled Stamp
            const stamp = document.createElement('div');
            stamp.className = `settled-stamp stamp-${hand.settled.toLowerCase()}`;
            const stampTexts = {
              'WIN': `WYGRANA 1:1 (+${hand.bet.toLocaleString()})`,
              'BJ': `BLACKJACK 3:2 (+${Math.floor(hand.bet * App.table.bjPayoutMultiplier).toLocaleString()})`,
              'PUSH': 'REMIS (ZWROT STAWKI)',
              'LOSE': `PRZEGRANA (-${hand.bet.toLocaleString()})`
            };
            stamp.textContent = stampTexts[hand.settled] || hand.settled;

            // Allow re-settle button
            const reSettleBtn = document.createElement('button');
            reSettleBtn.className = 'btn-hand-extra';
            reSettleBtn.style.marginTop = '6px';
            reSettleBtn.textContent = '✏️ Zmień wynik';
            reSettleBtn.addEventListener('click', () => {
              hand.settled = null;
              renderDealerTable();
            });

            handBox.appendChild(stamp);
            handBox.appendChild(reSettleBtn);
          } else {
            // Settlement buttons
            const btnGrid = document.createElement('div');
            btnGrid.className = 'settlement-buttons-grid';

            btnGrid.innerHTML = `
              <button class="btn-settle btn-settle-win" data-action="WIN">🟢 Wygrana 1:1</button>
              <button class="btn-settle btn-settle-bj" data-action="BJ">👑 Blackjack 3:2</button>
              <button class="btn-settle btn-settle-push" data-action="PUSH">🟡 Remis (Push)</button>
              <button class="btn-settle btn-settle-lose" data-action="LOSE">🔴 Przegrana</button>
            `;

            btnGrid.querySelectorAll('.btn-settle').forEach(btn => {
              btn.addEventListener('click', () => {
                const outcome = btn.dataset.action;
                const settleRes = App.table.settleHand(player.id, hIdx, outcome);
                if (settleRes.success) {
                  if (outcome === 'WIN') window.sounds.playWin();
                  else if (outcome === 'BJ') window.sounds.playBlackjack();
                  else if (outcome === 'PUSH') window.sounds.playPush();
                  else window.sounds.playLose();

                  broadcastTableState();
                  renderDealerTable();
                }
              });
            });

            handBox.appendChild(btnGrid);

            // Extra dealer actions: Dealer can trigger Double or Split for player if requested orally at physical table
            const extraActions = document.createElement('div');
            extraActions.className = 'hand-dealer-actions';

            if (!hand.isDouble) {
              const btnDbl = document.createElement('button');
              btnDbl.className = 'btn-hand-extra';
              btnDbl.textContent = '⚡ Double';
              btnDbl.addEventListener('click', () => {
                const res = App.table.doubleDown(player.id, hIdx);
                if (res.success) {
                  window.sounds.playChip();
                  broadcastTableState();
                  renderDealerTable();
                } else {
                  showToast(res.message);
                }
              });
              extraActions.appendChild(btnDbl);
            }

            if (!player.isSplit && player.hands.length === 1) {
              const btnSpl = document.createElement('button');
              btnSpl.className = 'btn-hand-extra';
              btnSpl.textContent = '✂️ Split';
              btnSpl.addEventListener('click', () => {
                const res = App.table.splitHand(player.id);
                if (res.success) {
                  window.sounds.playChip();
                  broadcastTableState();
                  renderDealerTable();
                } else {
                  showToast(res.message);
                }
              });
              extraActions.appendChild(btnSpl);
            }

            if (extraActions.children.length > 0) {
              handBox.appendChild(extraActions);
            }
          }
        }

        handsWrap.appendChild(handBox);
      });

      card.appendChild(handsWrap);
      container.appendChild(card);
    });
  }

  // ==========================================================================
  // REBUY / EDIT CHIPS MODAL (Dealer)
  // ==========================================================================
  const modalRebuy = document.getElementById('modal-rebuy');
  function openRebuyModal(player) {
    App.selectedPlayerForRebuy = player;
    document.getElementById('rebuy-player-name').textContent = `Gracz: ${player.avatar} ${player.name}`;
    document.getElementById('rebuy-current-chips').textContent = player.chips.toLocaleString();
    document.getElementById('input-custom-chips').value = player.chips;
    modalRebuy.classList.remove('hidden');
  }

  document.getElementById('btn-close-rebuy').addEventListener('click', () => {
    modalRebuy.classList.add('hidden');
  });

  document.querySelectorAll('.btn-rebuy-add').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!App.selectedPlayerForRebuy) return;
      window.sounds.playChip();
      const add = parseInt(btn.dataset.amount, 10);
      App.table.addPlayerChips(App.selectedPlayerForRebuy.id, add);
      document.getElementById('rebuy-current-chips').textContent = App.selectedPlayerForRebuy.chips.toLocaleString();
      document.getElementById('input-custom-chips').value = App.selectedPlayerForRebuy.chips;
      broadcastTableState();
      renderDealerTable();
      showToast(`Dodano +${add} żetonów dla gracza ${App.selectedPlayerForRebuy.name}`);
    });
  });

  document.getElementById('btn-confirm-rebuy').addEventListener('click', () => {
    if (!App.selectedPlayerForRebuy) return;
    const newAmount = parseInt(document.getElementById('input-custom-chips').value, 10);
    if (!isNaN(newAmount)) {
      App.table.setPlayerChips(App.selectedPlayerForRebuy.id, newAmount);
      broadcastTableState();
      renderDealerTable();
      showToast('Zaktualizowano saldo');
    }
    modalRebuy.classList.add('hidden');
  });

  document.getElementById('btn-kick-player').addEventListener('click', () => {
    if (!App.selectedPlayerForRebuy) return;
    if (confirm(`Usunąć gracza ${App.selectedPlayerForRebuy.name} ze stołu?`)) {
      App.table.removePlayer(App.selectedPlayerForRebuy.id);
      broadcastTableState();
      renderDealerTable();
      modalRebuy.classList.add('hidden');
      showToast('Gracz usunięty ze stołu');
    }
  });

  // Session Stats Modal
  document.getElementById('btn-open-stats')?.addEventListener('click', () => {
    if (App.role !== 'DEALER' || !App.table) return;
    window.sounds.playClick();
    renderStatsModal();
    document.getElementById('modal-stats').classList.remove('hidden');
  });

  document.getElementById('btn-close-stats')?.addEventListener('click', () => {
    document.getElementById('modal-stats').classList.add('hidden');
  });

  document.getElementById('modal-stats')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-stats')) {
      document.getElementById('modal-stats').classList.add('hidden');
    }
  });

  // ==========================================================================
  // SETTINGS & THEME MODAL
  // ==========================================================================
  const modalSettings = document.getElementById('modal-settings');

  function openSettingsModal() {
    window.sounds.playClick();
    // Sync active theme buttons
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === App.theme);
    });
    // Sync active layout buttons
    document.querySelectorAll('#layout-selector .layout-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.layout === App.dealerLayout);
    });
    // Sync audio and vibration toggles
    const soundToggle = document.getElementById('setting-toggle-sound');
    const vibToggle = document.getElementById('setting-toggle-vibration');
    if (soundToggle) soundToggle.checked = !window.sounds.isMuted;
    if (vibToggle) vibToggle.checked = window.sounds.vibrationEnabled;

    modalSettings.classList.remove('hidden');
  }

  function closeSettingsModal() {
    window.sounds.playClick();
    modalSettings.classList.add('hidden');
  }

  // Open settings buttons across all screens
  const settingsButtons = [
    document.getElementById('btn-welcome-settings'),
    document.getElementById('btn-open-settings'),
    document.getElementById('btn-player-settings'),
    ...document.querySelectorAll('.btn-sub-settings')
  ];

  settingsButtons.forEach(btn => {
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openSettingsModal();
      });
    }
  });

  document.getElementById('btn-close-settings')?.addEventListener('click', closeSettingsModal);
  document.getElementById('btn-save-settings')?.addEventListener('click', () => {
    closeSettingsModal();
    showToast('Zapisano ustawienia stołu');
  });

  modalSettings?.addEventListener('click', (e) => {
    if (e.target === modalSettings) {
      closeSettingsModal();
    }
  });

  // Theme change buttons
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.theme;
      setTheme(theme);
      window.sounds.playChip();
      const themeNames = {
        green: 'Zielony (Szmaragd)',
        purple: 'Fioletowy (Królewski Velvet)',
        red: 'Czerwony (Monte Carlo Rubin)',
        blue: 'Niebieski (Królewski Szafir)'
      };
      showToast(`Wybrano motyw: ${themeNames[theme] || theme}`);
    });
  });

  // Layout selection inside settings modal
  document.querySelectorAll('#layout-selector .layout-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const layout = btn.dataset.layout;
      setDealerLayout(layout);
      window.sounds.playClick();
      showToast(layout === 'semicircle' ? 'Układ stołu: Półkole kasynowe 🎪' : 'Układ stołu: Siatka kafelków 🔲');
    });
  });

  // Quick Layout Toggle button in Dealer Topbar
  document.getElementById('btn-toggle-layout')?.addEventListener('click', () => {
    const nextLayout = App.dealerLayout === 'semicircle' ? 'grid' : 'semicircle';
    setDealerLayout(nextLayout);
    window.sounds.playClick();
    showToast(nextLayout === 'semicircle' ? 'Układ stołu: Półkole kasynowe 🎪' : 'Układ stołu: Siatka kafelków 🔲');
  });

  // Audio and Haptics settings
  document.getElementById('setting-toggle-sound')?.addEventListener('change', (e) => {
    window.sounds.setMuted(!e.target.checked);
    const soundBtn = document.getElementById('btn-toggle-sound');
    if (soundBtn) soundBtn.textContent = e.target.checked ? '🔊' : '🔇';
  });

  document.getElementById('setting-toggle-vibration')?.addEventListener('change', (e) => {
    window.sounds.setVibrationEnabled(e.target.checked);
    if (e.target.checked) window.sounds.vibrate(25);
  });

  function renderStatsModal() {
    const wrap = document.getElementById('stats-summary-content');
    const playersList = Array.from(App.table.players.values());

    if (playersList.length === 0) {
      wrap.innerHTML = '<p style="color: var(--text-muted); padding: 20px 0;">Brak graczy przy stole</p>';
      return;
    }

    let html = `
      <table class="stats-table">
        <thead>
          <tr>
            <th>Gracz</th>
            <th>Żetony</th>
            <th>Bilans</th>
          </tr>
        </thead>
        <tbody>
    `;

    playersList.forEach(p => {
      const diff = p.chips - p.initialChips;
      const diffFormatted = diff > 0 ? `+${diff.toLocaleString()}` : `${diff.toLocaleString()}`;
      const diffClass = diff >= 0 ? 'stats-profit-plus' : 'stats-profit-minus';

      html += `
        <tr>
          <td>${p.avatar} ${escapeHtml(p.name)}</td>
          <td><strong>${p.chips.toLocaleString()}</strong></td>
          <td class="${diffClass}">${diffFormatted}</td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    wrap.innerHTML = html;
  }

  // ==========================================================================
  // PLAYER: JOIN ROOM
  // ==========================================================================
  const formJoin = document.getElementById('form-join-room');
  formJoin.addEventListener('submit', async (e) => {
    e.preventDefault();
    window.sounds.playClick();

    const nameInput = document.getElementById('input-player-name').value.trim();
    const codeInput = document.getElementById('input-room-code').value.trim().toUpperCase();

    if (!nameInput || !codeInput) return;

    App.playerData.name = nameInput;
    localStorage.setItem('bj_player_name', nameInput);
    App.roomCode = codeInput;
    App.role = 'PLAYER';

    const joinBtn = document.getElementById('btn-submit-join');
    joinBtn.disabled = true;
    joinBtn.innerHTML = '<span>Łączenie ze stołem...</span> ⏳';

    try {
      showToast('Nawiązywanie połączenia P2P ze stołem...');
      await window.network.connectAsPlayer(codeInput, App.playerData);

      document.getElementById('player-view-name').textContent = App.playerData.name;
      document.getElementById('player-view-avatar').textContent = App.playerData.avatar;
      document.getElementById('player-view-room').textContent = App.roomCode;

      switchScreen('player');
      showToast('Pomyślnie dołączono do gry!');
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Nie udało się połączyć ze stołem.');
      joinBtn.disabled = false;
      joinBtn.innerHTML = '<span>Zajmij Miejsce</span> <span class="btn-icon">🎲</span>';
    }
  });

  // ==========================================================================
  // PLAYER NETWORK EVENTS
  // ==========================================================================
  window.network.on('message_received', ({ data }) => {
    if (App.role !== 'PLAYER') return;

    switch (data.type) {
      case 'WELCOME': {
        App.tableStateCache = data.tableState;
        updatePlayerUIFromState(data.tableState);
        break;
      }

      case 'TABLE_UPDATE': {
        App.tableStateCache = data.tableState;
        updatePlayerUIFromState(data.tableState);
        break;
      }

      case 'BET_ERROR': {
        showToast(`⚠️ ${data.message}`);
        // Reset tentative bet on error
        App.playerData.tentativeBet = App.playerData.activeBet;
        renderTentativeBet();
        break;
      }
    }
  });

  window.network.on('disconnected_from_host', () => {
    if (App.role === 'PLAYER') {
      showToast('⚠️ Utracono połączenie ze stołem krupiera!');
      document.getElementById('player-status-banner').textContent = 'Rozłączono ze stołem. Odśwież stronę.';
    }
  });

  // Update Player UI from synced table state
  function updatePlayerUIFromState(state) {
    if (!state) return;

    const me = state.players.find(p => p.id === App.playerData.id);
    if (!me) return;

    // Update Chips & Local cache
    App.playerData.chips = me.chips;
    App.playerData.isSplit = me.isSplit;
    document.getElementById('player-view-balance').textContent = me.chips.toLocaleString();

    // Check Hands
    const hand1 = me.hands[0];
    const hand2 = me.hands[1];

    App.playerData.activeBet = hand1 ? hand1.bet : 0;
    if (App.playerData.activeBet > 0) {
      App.playerData.lastBet = App.playerData.activeBet;
    }

    // Phase Banner
    const banner = document.getElementById('player-status-banner');
    const chipRack = document.querySelector('.player-chip-rack');
    const btnConfirm = document.getElementById('btn-player-confirm-bet');
    const btnDouble = document.getElementById('btn-player-double');
    const btnSplit = document.getElementById('btn-player-split');
    const btnClear = document.getElementById('btn-player-clear');
    const btnRepeat = document.getElementById('btn-player-repeat');

    if (state.phase === 'BETTING') {
      banner.textContent = '🟢 Postaw zakład przed rozdaniem kart';
      banner.style.color = 'var(--gold-light)';
      chipRack.style.pointerEvents = 'auto';
      chipRack.style.opacity = '1';
      btnClear.disabled = false;
      btnRepeat.disabled = App.playerData.lastBet <= 0 || App.playerData.lastBet > App.playerData.chips;
      btnDouble.disabled = true;
      btnSplit.disabled = true;

      // Reset result overlay
      document.getElementById('player-round-result').classList.add('hidden');
    } else if (state.phase === 'ACTION') {
      banner.textContent = '🃏 Karty na stole! Obserwuj rozdanie';
      banner.style.color = '#38bdf8';
      chipRack.style.pointerEvents = 'none';
      chipRack.style.opacity = '0.5';
      btnConfirm.disabled = true;
      btnClear.disabled = true;
      btnRepeat.disabled = true;

      // Allow Double if hand 1 not doubled and has enough chips
      btnDouble.disabled = !hand1 || hand1.isDouble || me.chips < hand1.bet;
      // Allow Split if not already split and has enough chips
      btnSplit.disabled = me.isSplit || !hand1 || me.chips < hand1.bet;
    } else if (state.phase === 'ROUND_OVER') {
      banner.textContent = '✨ Runda zakończona. Krupier rozliczył stół';
      banner.style.color = 'var(--color-win)';
      chipRack.style.pointerEvents = 'none';
      chipRack.style.opacity = '0.5';
      btnConfirm.disabled = true;
      btnDouble.disabled = true;
      btnSplit.disabled = true;
      btnClear.disabled = true;

      // Show result overlay if hand has settled outcome
      checkAndShowRoundResult(me);
    }

    // Render Bet Slots
    renderPlayerBetSlots(me);
  }

  function renderPlayerBetSlots(me) {
    const slot1 = document.getElementById('bet-slot-1');
    const stack1 = document.getElementById('bet-stack-1');
    const amount1 = document.getElementById('bet-amount-1');

    const slot2 = document.getElementById('bet-slot-2');
    const stack2 = document.getElementById('bet-stack-2');
    const amount2 = document.getElementById('bet-amount-2');

    const hand1 = me.hands[0];
    const hand2 = me.hands[1];

    // Hand 1
    const bet1 = (App.tableStateCache && App.tableStateCache.phase === 'BETTING' && App.playerData.tentativeBet > 0)
      ? App.playerData.tentativeBet
      : (hand1 ? hand1.bet : 0);

    amount1.textContent = bet1.toLocaleString();
    renderChipStack(stack1, bet1);

    // Hand 2 (Split)
    if (me.isSplit && hand2) {
      slot2.classList.remove('hidden');
      amount2.textContent = hand2.bet.toLocaleString();
      renderChipStack(stack2, hand2.bet);
    } else {
      slot2.classList.add('hidden');
    }
  }

  function renderChipStack(container, amount) {
    container.innerHTML = '';
    if (amount <= 0) {
      container.innerHTML = '<span class="empty-bet-hint">Dotknij żetony poniżej</span>';
      return;
    }

    // Break down amount into representative chips for visual stack
    const chipDenoms = [500, 100, 50, 25, 10];
    let remaining = amount;
    const chipsToRender = [];

    for (const d of chipDenoms) {
      const count = Math.floor(remaining / d);
      for (let i = 0; i < Math.min(count, 4); i++) {
        chipsToRender.push(d);
      }
      remaining %= d;
      if (chipsToRender.length >= 6) break; // Limit stack visual height
    }

    chipsToRender.forEach(denom => {
      const chipEl = document.createElement('div');
      chipEl.className = `stacked-chip chip-${denom}`;
      chipEl.textContent = denom;
      container.appendChild(chipEl);
    });
  }

  function checkAndShowRoundResult(me) {
    const resultOverlay = document.getElementById('player-round-result');
    const hand1 = me.hands[0];
    if (!hand1 || !hand1.settled) return;

    let totalProfit = 0;
    let anyWin = false;
    let anyBJ = false;

    me.hands.forEach(h => {
      if (h.settled === 'WIN') {
        totalProfit += h.bet;
        anyWin = true;
      } else if (h.settled === 'BJ') {
        totalProfit += Math.floor(h.bet * 1.5);
        anyBJ = true;
      } else if (h.settled === 'LOSE') {
        totalProfit -= h.bet;
      }
    });

    let titleText = 'PRZEGRANA';
    let titleClass = 'lose';

    if (anyBJ) {
      titleText = 'BLACKJACK! 👑';
      titleClass = 'bj';
      window.sounds.playBlackjack();
    } else if (totalProfit > 0) {
      titleText = 'WYGRANA! 🟢';
      titleClass = 'win';
      window.sounds.playWin();
    } else if (totalProfit === 0) {
      titleText = 'REMIS (PUSH) 🟡';
      titleClass = 'push';
      window.sounds.playPush();
    } else {
      window.sounds.playLose();
    }

    resultOverlay.innerHTML = `
      <div class="result-title ${titleClass}">${titleText}</div>
      <div class="result-amount ${totalProfit >= 0 ? 'stats-profit-plus' : 'stats-profit-minus'}">
        ${totalProfit >= 0 ? '+' : ''}${totalProfit.toLocaleString()} żetonów
      </div>
    `;

    resultOverlay.classList.remove('hidden');
  }

  // ==========================================================================
  // PLAYER INTERACTIVE CHIPS & BETTING
  // ==========================================================================
  document.querySelectorAll('.casino-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      if (!App.tableStateCache || App.tableStateCache.phase !== 'BETTING') return;

      const val = parseInt(chip.dataset.value, 10);
      const totalAvailable = App.playerData.chips + App.playerData.activeBet;

      if (App.playerData.tentativeBet + val > totalAvailable) {
        showToast('Nie masz tylu żetonów!');
        window.sounds.vibrate([20, 20]);
        return;
      }

      window.sounds.playChip();
      App.playerData.tentativeBet += val;
      renderTentativeBet();
    });
  });

  function renderTentativeBet() {
    const btnConfirm = document.getElementById('btn-player-confirm-bet');
    const amount1 = document.getElementById('bet-amount-1');
    const stack1 = document.getElementById('bet-stack-1');

    amount1.textContent = App.playerData.tentativeBet.toLocaleString();
    renderChipStack(stack1, App.playerData.tentativeBet);

    const minBet = App.tableStateCache ? App.tableStateCache.minBet : 10;
    const isDifferent = App.playerData.tentativeBet !== App.playerData.activeBet;
    const isValid = App.playerData.tentativeBet >= minBet || App.playerData.tentativeBet === 0;

    btnConfirm.disabled = !(isDifferent && isValid);
  }

  // Confirm Bet
  document.getElementById('btn-player-confirm-bet').addEventListener('click', () => {
    if (!App.tableStateCache || App.tableStateCache.phase !== 'BETTING') return;
    window.sounds.playChip();

    window.network.sendToHost({
      type: 'PLACE_BET',
      playerId: App.playerData.id,
      amount: App.playerData.tentativeBet
    });

    document.getElementById('btn-player-confirm-bet').disabled = true;
    showToast(`Postawiono zakład: ${App.playerData.tentativeBet} żetonów`);
  });

  // Clear Bet
  document.getElementById('btn-player-clear').addEventListener('click', () => {
    if (!App.tableStateCache || App.tableStateCache.phase !== 'BETTING') return;
    window.sounds.playClick();
    App.playerData.tentativeBet = 0;
    renderTentativeBet();
  });

  // Repeat Previous Bet
  document.getElementById('btn-player-repeat').addEventListener('click', () => {
    if (!App.tableStateCache || App.tableStateCache.phase !== 'BETTING') return;
    if (App.playerData.lastBet <= 0) return;

    const totalAvailable = App.playerData.chips + App.playerData.activeBet;
    if (App.playerData.lastBet > totalAvailable) {
      showToast('Za mało żetonów na powtórzenie!');
      return;
    }

    window.sounds.playChip();
    App.playerData.tentativeBet = App.playerData.lastBet;
    renderTentativeBet();
  });

  // Player Double Down Action
  document.getElementById('btn-player-double').addEventListener('click', () => {
    window.sounds.playClick();
    window.network.sendToHost({
      type: 'REQUEST_DOUBLE',
      playerId: App.playerData.id,
      handIndex: 0
    });
  });

  // Player Split Action
  document.getElementById('btn-player-split').addEventListener('click', () => {
    window.sounds.playClick();
    window.network.sendToHost({
      type: 'REQUEST_SPLIT',
      playerId: App.playerData.id
    });
  });

  // HTML Sanitizer
  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }
});
