import 'dart:async';
import 'dart:convert';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:fluttertoast/fluttertoast.dart';
import 'package:flutter/material.dart';
import 'auth_service.dart';
import 'custom_toast_service.dart';

class WebSocketService {
  static WebSocketService? _instance;
  static WebSocketService get instance => _instance ??= WebSocketService._();

  WebSocketService._();

  IO.Socket? _socket;
  bool _isConnected = false;
  Timer? _reconnectTimer;
  String? _currentPautaId;
  BuildContext? _context;

  // Streams para notificações em tempo real
  final StreamController<Map<String, dynamic>> _votoNotificationController =
      StreamController<Map<String, dynamic>>.broadcast();
  final StreamController<Map<String, dynamic>> _pautaStatusController =
      StreamController<Map<String, dynamic>>.broadcast();
  final StreamController<Map<String, dynamic>> _statsUpdateController =
      StreamController<Map<String, dynamic>>.broadcast();
  final StreamController<Map<String, dynamic>> _iniciarVotacaoController =
      StreamController<Map<String, dynamic>>.broadcast();
  final StreamController<Map<String, dynamic>> _encerrarVotacaoController =
      StreamController<Map<String, dynamic>>.broadcast();

  Stream<Map<String, dynamic>> get votoNotifications => _votoNotificationController.stream;
  Stream<Map<String, dynamic>> get pautaStatusUpdates => _pautaStatusController.stream;
  Stream<Map<String, dynamic>> get statsUpdates => _statsUpdateController.stream;
  Stream<Map<String, dynamic>> get iniciarVotacaoEvents => _iniciarVotacaoController.stream;
  Stream<Map<String, dynamic>> get encerrarVotacaoEvents => _encerrarVotacaoController.stream;

  bool get isConnected => _isConnected;

  /// Definir contexto para toasts customizados
  void setContext(BuildContext context) {
    _context = context;
  }

  /// Inicializa a conexão WebSocket
  Future<void> connect() async {
    if (_socket != null && _isConnected) {
      print('🔌 WebSocket já está conectado');
      return;
    }

    try {
      final token = AuthService.token;
      if (token == null) {
        print('❌ Token de autenticação não encontrado');
        return;
      }

      print('🔌 Conectando ao WebSocket...');

      _socket = IO.io('${AuthService.baseUrl}', {
        'transports': ['websocket', 'polling'],
        'auth': {'token': token},
        'timeout': 3000,           // Timeout ultra rápido
        'forceNew': true,
        'reconnection': true,      // Auto-reconexão ativa
        'reconnectionDelay': 500,  // Delay inicial de reconexão: 0.5s
        'reconnectionDelayMax': 1500, // Delay máximo: 1.5s
        'maxReconnectionAttempts': 15, // Mais tentativas
        'autoConnect': true,
        'forceNewConnection': false,
        'compression': false,      // Desabilitar compressão
      });

      _setupEventHandlers();

      // Aguardar conexão
      await _waitForConnection();

    } catch (e) {
      print('❌ Erro ao conectar WebSocket: $e');
      _scheduleReconnect();
    }
  }

  /// Aguarda a conexão ser estabelecida
  Future<void> _waitForConnection() async {
    final completer = Completer<void>();
    Timer? timeoutTimer;

    void onConnect() {
      timeoutTimer?.cancel();
      if (!completer.isCompleted) {
        completer.complete();
      }
    }

    void onError() {
      timeoutTimer?.cancel();
      if (!completer.isCompleted) {
        completer.completeError('Erro de conexão');
      }
    }

    _socket?.once('connect', (_) => onConnect());
    _socket?.once('connect_error', (_) => onError());

    timeoutTimer = Timer(const Duration(seconds: 3), () { // Timeout ultra reduzido
      if (!completer.isCompleted) {
        completer.completeError('Timeout na conexão');
      }
    });

    return completer.future;
  }

  /// Configura os handlers de eventos
  void _setupEventHandlers() {
    _socket?.on('connect', (_) {
      print('✅ Conectado ao WebSocket');
      _isConnected = true;
      _reconnectTimer?.cancel();

      // Entrar na pauta atual se existir
      if (_currentPautaId != null) {
        joinPauta(_currentPautaId!);
      }
    });

    _socket?.on('disconnect', (_) {
      print('❌ Desconectado do WebSocket');
      _isConnected = false;
      _scheduleReconnect();
    });

    _socket?.on('connect_error', (error) {
      print('❌ Erro de conexão WebSocket: $error');
      _isConnected = false;
      _scheduleReconnect();
    });

    // Eventos específicos da aplicação
    _socket?.on('connection-status', (data) {
      print('📡 Status de conexão: $data');
    });

    _socket?.on('voto-notification', (data) {
      print('🔔 Notificação de voto recebida: $data');
      _handleVotoNotification(data);
    });

    _socket?.on('pauta-stats-update', (data) {
      print('📊 Estatísticas atualizadas: $data');
      _statsUpdateController.add(Map<String, dynamic>.from(data));
    });

    _socket?.on('pauta-status-update', (data) {
      print('📢 Status da pauta atualizado: $data');
      _pautaStatusController.add(Map<String, dynamic>.from(data));
    });

    _socket?.on('pauta-status-notification', (data) {
      print('📢 Notificação de mudança de status: $data');
      _pautaStatusController.add(Map<String, dynamic>.from(data));
    });

    _socket?.on('vereador-connected', (data) {
      print('👤 Vereador conectado: $data');
      final message = '${data['nomeVereador']} entrou online';
      if (_context != null && _context!.mounted) {
        CustomToastService.showConnectionToast(_context!, message, isPositive: true);
      } else {
        _showConnectionToast(message, isPositive: true);
      }
    });

    _socket?.on('vereador-disconnected', (data) {
      print('👋 Vereador desconectado: $data');
      final message = '${data['nomeVereador']} saiu offline';
      if (_context != null && _context!.mounted) {
        CustomToastService.showConnectionToast(_context!, message, isPositive: false);
      } else {
        _showConnectionToast(message, isPositive: false);
      }
    });

    _socket?.on('error', (error) {
      print('❌ Erro WebSocket: $error');
      _showErrorToast('Erro de conexão: ${error['message'] ?? error}');
    });

    _socket?.on('pauta-joined', (data) {
      print('📋 Entrou na pauta: $data');
    });

    _socket?.on('pauta-left', (data) {
      print('📋 Saiu da pauta: $data');
    });

    // Evento de iniciar votação (abre tela de votação automaticamente)
    _socket?.on('iniciar-votacao', (data) {
      print('🗳️ Solicitação para iniciar votação recebida: $data');
      _handleIniciarVotacao(data);
    });

    // Evento de encerrar votação (volta ao dashboard)
    _socket?.on('encerrar-votacao', (data) {
      print('🏁 Solicitação para encerrar votação recebida: $data');
      _handleEncerrarVotacao(data);
    });
  }

  /// Processa notificações de voto
  void _handleVotoNotification(Map<String, dynamic> data) {
    _votoNotificationController.add(data);

    // Verificar se o usuário está na tela da mesma pauta antes de mostrar toast
    final currentUser = AuthService.currentUser;
    if (currentUser != null &&
        data['vereador'] != null &&
        data['pautaId'] != null &&
        _currentPautaId == data['pautaId'].toString()) {

      final vereadorVoto = data['vereador'];

      // Não mostrar toast para o próprio voto
      if (vereadorVoto['nome'] != currentUser['nome_parlamentar'] &&
          vereadorVoto['nome'] != currentUser['nome']) {

        final action = data['isUpdate'] == true ? 'alterou seu voto para' : 'votou';
        final message = '${vereadorVoto['nome']} $action ${data['voto']}';

        // Usar toast customizado se contexto estiver disponível
        if (_context != null && _context!.mounted) {
          CustomToastService.showVoteToast(_context!, message, data['voto']);
        } else {
          // Fallback para Fluttertoast
          _showVoteToast(message, data['voto']);
        }
      }
    }
  }

  /// Processa solicitação de iniciar votação
  void _handleIniciarVotacao(Map<String, dynamic> data) {
    print('🗳️ Processando solicitação de iniciar votação: $data');

    // Emitir evento para que as telas escutem e naveguem
    _iniciarVotacaoController.add(data);

    // Mostrar toast informativo
    final pautaNome = data['pautaNome'] ?? 'Pauta sem nome';
    final message = 'Iniciando votação: $pautaNome';

    if (_context != null && _context!.mounted) {
      CustomToastService.showInfoToast(_context!, message);
    } else {
      _showInfoToast(message);
    }
  }

  void _handleEncerrarVotacao(Map<String, dynamic> data) {
    print('🏁 Processando solicitação de encerrar votação: $data');

    // Emitir evento para que as telas escutem e naveguem de volta ao dashboard
    _encerrarVotacaoController.add(data);

    // Mostrar toast informativo
    final pautaNome = data['pautaNome'] ?? 'Pauta sem nome';
    final resultado = data['resultado'] ?? 'Finalizada';
    final message = 'Votação encerrada: $pautaNome - $resultado';

    if (_context != null && _context!.mounted) {
      CustomToastService.showInfoToast(_context!, message);
    } else {
      _showInfoToast(message);
    }
  }

  /// Entrar em uma room de pauta
  void joinPauta(String pautaId) {
    if (_socket != null && _isConnected) {
      print('📋 Entrando na pauta: $pautaId');
      _socket!.emit('join-pauta', pautaId);
      _currentPautaId = pautaId;
    } else {
      print('⚠️ WebSocket não conectado. Salvando pauta para entrar depois.');
      _currentPautaId = pautaId;
    }
  }

  /// Sair de uma room de pauta
  void leavePauta(String pautaId) {
    if (_socket != null && _isConnected) {
      print('📋 Saindo da pauta: $pautaId');
      _socket!.emit('leave-pauta', pautaId);
    }
    _currentPautaId = null;
  }

  /// Solicitar estatísticas de uma pauta
  void requestStats(String pautaId) {
    if (_socket != null && _isConnected) {
      _socket!.emit('request-stats', pautaId);
    }
  }

  /// Enviar ping para manter conexão
  void ping() {
    if (_socket != null && _isConnected) {
      _socket!.emit('ping');
    }
  }

  /// Agenda reconexão automática (mais rápida)
  void _scheduleReconnect() {
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(milliseconds: 500), () { // Reconexão ultra rápida
      if (!_isConnected) {
        print('🔄 Tentando reconectar...');
        connect();
      }
    });
  }

  /// Mostrar toast de voto customizado
  void _showVoteToast(String message, String voto) {
    Color backgroundColor;
    IconData icon;

    switch (voto) {
      case 'SIM':
        backgroundColor = const Color(0xFF2EA043); // Verde da paleta
        icon = Icons.thumb_up;
        break;
      case 'NÃO':
        backgroundColor = const Color(0xFFDA3633); // Vermelho da paleta
        icon = Icons.thumb_down;
        break;
      case 'ABSTENÇÃO':
        backgroundColor = const Color(0xFFF08833); // Laranja da paleta
        icon = Icons.remove_circle_outline;
        break;
      default:
        backgroundColor = const Color(0xFF58a6ff); // Azul da paleta
        icon = Icons.info;
    }

    // Usar toast customizado sem gradiente
    _showCustomToastOverlay(message, backgroundColor, icon);
  }

  /// Mostrar toast customizado com overlay (sem gradiente do sistema)
  void _showCustomToastOverlay(String message, Color backgroundColor, IconData icon) {
    // Nota: Este método necessita de um BuildContext ativo
    // Por enquanto, usar Fluttertoast com configurações otimizadas
    Fluttertoast.showToast(
      msg: message,
      toastLength: Toast.LENGTH_SHORT,
      gravity: ToastGravity.TOP,
      timeInSecForIosWeb: 3,
      backgroundColor: backgroundColor,
      textColor: Colors.white,
      fontSize: 14.0,
      webBgColor: '#${backgroundColor.value.toRadixString(16).substring(2)}', // Garantir cor sólida no web
      webPosition: "top",
      webShowClose: false,
    );
  }

  /// Mostrar toast de conexão
  void _showConnectionToast(String message, {required bool isPositive}) {
    Fluttertoast.showToast(
      msg: message,
      toastLength: Toast.LENGTH_SHORT,
      gravity: ToastGravity.TOP,
      timeInSecForIosWeb: 2,
      backgroundColor: isPositive
        ? const Color(0xFF2EA043) // Verde da paleta
        : const Color(0xFF6b7280), // Cinza da paleta
      textColor: Colors.white,
      fontSize: 12.0,
    );
  }

  /// Mostrar toast de erro
  void _showErrorToast(String message) {
    Fluttertoast.showToast(
      msg: message,
      toastLength: Toast.LENGTH_LONG,
      gravity: ToastGravity.CENTER,
      timeInSecForIosWeb: 4,
      backgroundColor: const Color(0xFFDA3633), // Vermelho da paleta
      textColor: Colors.white,
      fontSize: 14.0,
    );
  }

  /// Mostrar toast informativo
  void _showInfoToast(String message) {
    Fluttertoast.showToast(
      msg: message,
      toastLength: Toast.LENGTH_SHORT,
      gravity: ToastGravity.CENTER,
      timeInSecForIosWeb: 3,
      backgroundColor: const Color(0xFF58a6ff), // Azul da paleta
      textColor: Colors.white,
      fontSize: 14.0,
    );
  }

  /// Mostrar toast personalizado
  void showCustomToast(String message, {
    Color? backgroundColor,
    ToastGravity gravity = ToastGravity.BOTTOM,
    int duration = 3,
  }) {
    Fluttertoast.showToast(
      msg: message,
      toastLength: Toast.LENGTH_SHORT,
      gravity: gravity,
      timeInSecForIosWeb: duration,
      backgroundColor: backgroundColor ?? const Color(0xFF58a6ff), // Azul da paleta
      textColor: Colors.white,
      fontSize: 14.0,
    );
  }

  /// Desconectar do WebSocket
  void disconnect() {
    print('🔌 Desconectando WebSocket...');

    _reconnectTimer?.cancel();

    if (_currentPautaId != null) {
      leavePauta(_currentPautaId!);
    }

    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _isConnected = false;
    _currentPautaId = null;
  }

  /// Limpar recursos
  void dispose() {
    disconnect();
    _votoNotificationController.close();
    _pautaStatusController.close();
    _statsUpdateController.close();
  }

  /// Verificar se está conectado e reconectar se necessário
  Future<void> ensureConnection() async {
    if (!_isConnected) {
      await connect();
    }
  }

  /// Obter informações de debug
  Map<String, dynamic> getDebugInfo() {
    return {
      'isConnected': _isConnected,
      'socketId': _socket?.id,
      'currentPauta': _currentPautaId,
      'hasReconnectTimer': _reconnectTimer?.isActive ?? false,
    };
  }
}