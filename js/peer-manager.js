/**
 * 21CHIPS - WebRTC P2P PeerJS Network Manager
 * Handles serverless direct communication between Dealer (Host) and Players.
 */

class PeerNetworkManager {
  constructor() {
    this.peer = null;
    this.isHost = false;
    this.roomCode = null;
    this.hostConnection = null; // Used by Player
    this.clientConnections = new Map(); // Used by Host (peerId -> DataConnection)
    this.callbacks = {};
    this.peerPrefix = 'bj21-table-';
  }

  // Register event callbacks
  on(event, callback) {
    if (!this.callbacks[event]) this.callbacks[event] = [];
    this.callbacks[event].push(callback);
  }

  trigger(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(cb => cb(data));
    }
  }

  /**
   * Initialize Host (Dealer) Peer
   * @param {string} roomCode 
   */
  initHost(roomCode) {
    return new Promise((resolve, reject) => {
      this.isHost = true;
      this.roomCode = roomCode.toUpperCase();
      const peerId = `${this.peerPrefix}${this.roomCode.toLowerCase()}`;

      // Initialize PeerJS with public cloud broker
      this.peer = new Peer(peerId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });

      this.peer.on('open', (id) => {
        console.log(`[Host] Stół gotowy. ID: ${id}, Kod: ${this.roomCode}`);
        resolve(this.roomCode);
      });

      this.peer.on('connection', (conn) => {
        this.handleIncomingConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.error('[Host] Błąd PeerJS:', err);
        if (err.type === 'unavailable-id') {
          // If code is taken, suggest picking another or retry
          this.trigger('error', 'Ten kod stołu jest już zajęty. Zmień kod lub odczekaj chwilę.');
        } else {
          this.trigger('error', `Błąd sieci: ${err.type}`);
        }
        reject(err);
      });

      this.peer.on('disconnected', () => {
        console.warn('[Host] Rozłączono z serwerem sygnalizacji. Próba ponownego połączenia...');
        this.peer.reconnect();
      });
    });
  }

  /**
   * Handle incoming connection from a player (Host side)
   */
  handleIncomingConnection(conn) {
    const peerId = conn.peer;
    console.log(`[Host] Nowy gracz łączy się: ${peerId}`);

    conn.on('open', () => {
      this.clientConnections.set(peerId, conn);
      this.trigger('player_connected', { peerId });
    });

    conn.on('data', (data) => {
      this.trigger('message_received', { peerId, data });
    });

    conn.on('close', () => {
      console.log(`[Host] Gracz rozłączony: ${peerId}`);
      this.clientConnections.delete(peerId);
      this.trigger('player_disconnected', { peerId });
    });

    conn.on('error', (err) => {
      console.error(`[Host] Błąd połączenia z ${peerId}:`, err);
      this.clientConnections.delete(peerId);
      this.trigger('player_disconnected', { peerId });
    });
  }

  /**
   * Initialize Player Peer & Connect to Host
   * @param {string} roomCode 
   * @param {object} playerInfo 
   */
  connectAsPlayer(roomCode, playerInfo) {
    return new Promise((resolve, reject) => {
      this.isHost = false;
      this.roomCode = roomCode.toUpperCase();
      const hostPeerId = `${this.peerPrefix}${this.roomCode.toLowerCase()}`;

      // Initialize player with random peer ID
      this.peer = new Peer(null, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });

      this.peer.on('open', (myId) => {
        console.log(`[Player] Moje Peer ID: ${myId}. Łączenie ze stołem ${hostPeerId}...`);

        const conn = this.peer.connect(hostPeerId, {
          reliable: true
        });

        const connectionTimeout = setTimeout(() => {
          if (!this.hostConnection || !this.hostConnection.open) {
            reject(new Error('Nie znaleziono stołu o tym kodzie lub stół jest offline.'));
          }
        }, 8000);

        conn.on('open', () => {
          clearTimeout(connectionTimeout);
          this.hostConnection = conn;
          console.log('[Player] Połączono ze stołem!');

          // Send JOIN message
          this.sendToHost({
            type: 'JOIN',
            playerId: playerInfo.id,
            name: playerInfo.name,
            avatar: playerInfo.avatar
          });

          resolve(conn);
        });

        conn.on('data', (data) => {
          this.trigger('message_received', { data });
        });

        conn.on('close', () => {
          console.warn('[Player] Połączenie ze stołem zostało zamknięte.');
          this.trigger('disconnected_from_host');
        });

        conn.on('error', (err) => {
          console.error('[Player] Błąd połączenia ze stołem:', err);
          clearTimeout(connectionTimeout);
          reject(err);
        });
      });

      this.peer.on('error', (err) => {
        console.error('[Player] Błąd PeerJS:', err);
        reject(err);
      });
    });
  }

  /**
   * Send message to Host (Player side)
   * @param {object} data 
   */
  sendToHost(data) {
    if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send(data);
    } else {
      console.warn('[Player] Brak aktywnego połączenia ze stołem');
    }
  }

  /**
   * Send message to a specific Player (Host side)
   * @param {string} peerId 
   * @param {object} data 
   */
  sendToClient(peerId, data) {
    const conn = this.clientConnections.get(peerId);
    if (conn && conn.open) {
      conn.send(data);
    }
  }

  /**
   * Broadcast message to all connected Players (Host side)
   * @param {object} data 
   */
  broadcast(data) {
    this.clientConnections.forEach((conn) => {
      if (conn.open) {
        conn.send(data);
      }
    });
  }
}

// Global Network Manager
window.network = new PeerNetworkManager();
