import 'package:flutter/material.dart';
import 'dart:async';
import 'services/auth_service.dart';
import 'services/websocket_service.dart';

enum VotoOpcao { sim, nao, abstencao, nenhum }

class VotacaoPautaScreen extends StatefulWidget {
  final Map<String, dynamic> pauta;

  const VotacaoPautaScreen({
    super.key,
    required this.pauta,
  });

  @override
  State<VotacaoPautaScreen> createState() => _VotacaoPautaScreenState();
}

class _VotacaoPautaScreenState extends State<VotacaoPautaScreen> {
  VotoOpcao _votoSelecionado = VotoOpcao.nenhum;
  bool _isUserConnected = true;
  bool _isVoting = false;
  bool _votoFoiRegistrado = false; // Flag para indicar se um voto foi registrado

  // Estatísticas em tempo real
  Map<String, dynamic>? _estatisticas;
  bool _isLoadingStats = false;

  // WebSocket
  final WebSocketService _webSocketService = WebSocketService.instance;
  StreamSubscription<Map<String, dynamic>>? _votoNotificationSubscription;
  StreamSubscription<Map<String, dynamic>>? _statsUpdateSubscription;
  StreamSubscription<Map<String, dynamic>>? _encerrarVotacaoSubscription;

  @override
  void initState() {
    super.initState();
    _loadVereadorData();
    _checkExistingVote();
    _loadEstatisticas();
    _initializeWebSocket();
    _startRealTimeUpdates();
  }

  @override
  void dispose() {
    _votoNotificationSubscription?.cancel();
    _statsUpdateSubscription?.cancel();
    _encerrarVotacaoSubscription?.cancel();
    _webSocketService.leavePauta(widget.pauta['id'].toString());
    super.dispose();
  }

  Future<void> _loadVereadorData() async {
    try {
      await AuthService.getVereadorDetails();
      // Dados carregados com sucesso (não utilizados no momento)
    } catch (e) {
      print('Erro ao carregar dados do vereador: $e');
    }
  }

  Future<void> _checkExistingVote() async {
    try {
      print('🔍 Verificando se já existe voto para a pauta ${widget.pauta['id']}');

      final response = await AuthService.getVotoEmPauta(widget.pauta['id'].toString());

      if (response != null && response['voto'] != null) {
        final votoData = response['voto'];
        final votoString = votoData['voto'];

        print('✅ Voto existente encontrado: $votoString');

        // Mapear string do banco para enum
        VotoOpcao votoExistente;
        switch (votoString) {
          case 'SIM':
            votoExistente = VotoOpcao.sim;
            break;
          case 'NÃO':
            votoExistente = VotoOpcao.nao;
            break;
          case 'ABSTENÇÃO':
            votoExistente = VotoOpcao.abstencao;
            break;
          default:
            print('⚠️ Voto desconhecido: $votoString');
            return;
        }

        if (mounted) {
          setState(() {
            _votoSelecionado = votoExistente;
          });

          // Mostrar mensagem informativa
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Você já votou nesta pauta: ${_getVotoDisplayName(votoExistente)}'),
              backgroundColor: const Color(0xFF58a6ff), // Azul da paleta
              duration: const Duration(seconds: 3),
            ),
          );
        }
      } else {
        print('ℹ️ Nenhum voto existente encontrado para esta pauta');
      }
    } catch (e) {
      print('❌ Erro ao verificar voto existente: $e');
    }
  }

  String _getVotoDisplayName(VotoOpcao voto) {
    switch (voto) {
      case VotoOpcao.sim:
        return 'SIM';
      case VotoOpcao.nao:
        return 'NÃO';
      case VotoOpcao.abstencao:
        return 'ABSTENÇÃO';
      case VotoOpcao.nenhum:
        return 'NENHUM';
    }
  }

  Future<void> _loadEstatisticas() async {
    setState(() {
      _isLoadingStats = true;
    });

    try {
      print('📊 Carregando estatísticas para a pauta ${widget.pauta['id']}');

      final response = await AuthService.getEstatisticasPauta(widget.pauta['id'].toString());

      if (response != null && response['estatisticas'] != null) {
        if (mounted) {
          setState(() {
            _estatisticas = response['estatisticas'];
          });
        }
        print('✅ Estatísticas carregadas: $_estatisticas');
      } else {
        print('⚠️ Nenhuma estatística encontrada');
      }
    } catch (e) {
      print('❌ Erro ao carregar estatísticas: $e');
    } finally {
      if (mounted) {
        setState(() {
          _isLoadingStats = false;
        });
      }
    }
  }

  /// Inicializa WebSocket para atualizações em tempo real
  Future<void> _initializeWebSocket() async {
    try {
      // Definir contexto para toasts customizados
      _webSocketService.setContext(context);

      // Conectar ao WebSocket
      await _webSocketService.connect();

      // Entrar na room da pauta
      _webSocketService.joinPauta(widget.pauta['id'].toString());

      // Escutar notificações de voto
      _votoNotificationSubscription = _webSocketService.votoNotifications.listen((data) {
        print('🔔 Notificação de voto recebida: $data');
        // As notificações de toast já são tratadas no WebSocketService
        // Aqui apenas recarregamos as estatísticas se for da pauta atual
        if (data['pautaId'] != null && data['pautaId'].toString() == widget.pauta['id'].toString()) {
          _loadEstatisticas();
        }
      });

      // Escutar atualizações de estatísticas
      _statsUpdateSubscription = _webSocketService.statsUpdates.listen((data) {
        print('📊 Estatísticas atualizadas via WebSocket: $data');
        if (mounted && data['estatisticas'] != null) {
          setState(() {
            _estatisticas = data['estatisticas'];
          });
        }
      });

      // Escutar encerramento de votação (volta ao dashboard)
      _encerrarVotacaoSubscription = _webSocketService.encerrarVotacaoEvents.listen((data) {
        print('🏁 Evento de encerramento de votação recebido: $data');
        final pautaIdEncerrada = data['pautaId']?.toString();
        if (pautaIdEncerrada == widget.pauta['id'].toString()) {
          // Voltar ao dashboard
          if (mounted) {
            Navigator.of(context).pop();
          }
        }
      });

      // Atualizar status de conexão
      if (mounted) {
        setState(() {
          _isUserConnected = _webSocketService.isConnected;
        });
      }

      print('✅ WebSocket inicializado com sucesso para a pauta ${widget.pauta['id']}');

    } catch (e) {
      print('❌ Erro ao inicializar WebSocket: $e');
      // Manter polling como fallback
    }
  }

  void _startRealTimeUpdates() {
    // Se WebSocket está conectado, usar apenas ele
    if (_webSocketService.isConnected) {
      print('🔌 WebSocket ativo - usando atualizações em tempo real via WebSocket');
      return;
    }

    // Fallback: Atualizar estatísticas a cada 3 segundos via polling
    print('📡 Usando polling como fallback para atualizações em tempo real');
    Future.doWhile(() async {
      if (!mounted) return false;

      await Future.delayed(const Duration(milliseconds: 1500)); // Polling mais rápido

      // Se WebSocket conectou, parar polling
      if (_webSocketService.isConnected) {
        print('🔌 WebSocket conectou - parando polling');
        return false;
      }

      if (mounted) {
        await _loadEstatisticas();
      }

      return mounted;
    });
  }

  Future<void> _submitVote() async {
    if (_votoSelecionado == VotoOpcao.nenhum) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Por favor, selecione uma opção de voto'),
          backgroundColor: Color(0xFFF08833), // Laranja da paleta
          duration: Duration(seconds: 2),
        ),
      );
      return;
    }

    setState(() {
      _isVoting = true;
    });

    try {
      // Mapear enum para string
      String votoString;
      switch (_votoSelecionado) {
        case VotoOpcao.sim:
          votoString = 'Sim';
          break;
        case VotoOpcao.nao:
          votoString = 'Não';
          break;
        case VotoOpcao.abstencao:
          votoString = 'Abstenção';
          break;
        case VotoOpcao.nenhum:
          return; // Não deveria chegar aqui
      }

      print('🗳️ Enviando voto: $votoString para pauta ${widget.pauta['id']}');

      final response = await AuthService.registrarVoto(widget.pauta['id'], votoString);

      if (response != null && response['success'] != false) {
        setState(() {
          _votoFoiRegistrado = true; // Marcar que um voto foi registrado
        });

        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Voto registrado com sucesso!'),
            backgroundColor: Color(0xFF2EA043), // Verde da paleta
            duration: Duration(seconds: 2), // Duração mais curta
          ),
        );

        // Recarregar estatísticas após o voto
        await _loadEstatisticas();
      } else {
        final errorMessage = response?['error'] ?? 'Erro ao registrar voto';
        throw Exception(errorMessage);
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Erro ao registrar voto: $e'),
          backgroundColor: const Color(0xFFDA3633), // Vermelho da paleta
          duration: const Duration(seconds: 3),
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isVoting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0d1117),
      appBar: AppBar(
        backgroundColor: const Color(0xFF21262d),
        title: const Text(
          'Votação de Pauta',
          style: TextStyle(color: Colors.white),
        ),
        leading: IconButton(
          onPressed: () => Navigator.of(context).pop(_votoFoiRegistrado),
          icon: const Icon(Icons.arrow_back, color: Colors.white),
        ),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 16, top: 8, bottom: 8),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: _getConnectionColor(),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  _getConnectionIcon(),
                  color: Colors.white,
                  size: 16,
                ),
                const SizedBox(width: 6),
                Text(
                  _getConnectionText(),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20.0),
          child: ConstrainedBox(
            constraints: BoxConstraints(
              minHeight: MediaQuery.of(context).size.height -
                         AppBar().preferredSize.height -
                         MediaQuery.of(context).padding.top -
                         MediaQuery.of(context).padding.bottom - 40,
            ),
            child: IntrinsicHeight(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _buildPautaInfo(),
                  const SizedBox(height: 20),
                  _buildVotingOptions(),
                  const SizedBox(height: 20),
                  _buildEstatisticasCard(),
                  const SizedBox(height: 20),
                  _buildVoteButton(),
                  const SizedBox(height: 20), // Espaçamento extra no final
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }


  Widget _buildPautaInfo() {
    return Card(
      color: const Color(0xFF21262d),
      elevation: 4,
      child: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.blue.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: Colors.blue, width: 1),
                  ),
                  child: const Text(
                    'EM VOTAÇÃO',
                    style: TextStyle(
                      color: Colors.blue,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Text(
              widget.pauta['nome'] ?? 'Nome da pauta não disponível',
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 12),
            if (widget.pauta['descricao'] != null && widget.pauta['descricao'].isNotEmpty)
              Text(
                widget.pauta['descricao'],
                style: const TextStyle(
                  fontSize: 16,
                  color: Colors.white70,
                  height: 1.4,
                ),
              ),
            const SizedBox(height: 12),
            if (widget.pauta['autor'] != null)
              Row(
                children: [
                  const Icon(Icons.person, color: Colors.white60, size: 18),
                  const SizedBox(width: 8),
                  Text(
                    'Autor: ${widget.pauta['autor']}',
                    style: const TextStyle(
                      fontSize: 14,
                      color: Colors.white60,
                    ),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildVotingOptions() {
    return Card(
      color: const Color(0xFF21262d),
      elevation: 4,
      child: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.how_to_vote, color: Colors.white, size: 20),
                SizedBox(width: 8),
                Text(
                  'Seu Voto',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            _buildEnhancedVoteOption(VotoOpcao.sim, 'SIM', 'Favorável à aprovação', Colors.green, Icons.thumb_up),
            const SizedBox(height: 12),
            _buildEnhancedVoteOption(VotoOpcao.nao, 'NÃO', 'Contrário à aprovação', Colors.red, Icons.thumb_down),
            const SizedBox(height: 12),
            _buildEnhancedVoteOption(VotoOpcao.abstencao, 'ABSTENÇÃO', 'Não manifesta opinião', Colors.orange, Icons.remove_circle_outline),
          ],
        ),
      ),
    );
  }

  Widget _buildEnhancedVoteOption(VotoOpcao opcao, String titulo, String descricao, Color cor, IconData icone) {
    final isSelected = _votoSelecionado == opcao;

    return GestureDetector(
      onTap: () {
        setState(() {
          _votoSelecionado = opcao;
        });
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isSelected ? cor.withValues(alpha: 0.15) : const Color(0xFF0d1117),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? cor : Colors.grey[700]!,
            width: isSelected ? 3 : 1,
          ),
          boxShadow: isSelected ? [
            BoxShadow(
              color: cor.withValues(alpha: 0.3),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ] : null,
        ),
        child: Row(
          children: [
            Container(
              width: 24,
              height: 24,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: isSelected ? cor : Colors.grey[600]!,
                  width: 2,
                ),
                color: isSelected ? cor : Colors.transparent,
              ),
              child: isSelected
                ? const Icon(Icons.check, color: Colors.white, size: 16)
                : null,
            ),
            const SizedBox(width: 16),
            Icon(
              icone,
              color: isSelected ? cor : Colors.grey[400],
              size: 24,
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    titulo,
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: isSelected ? cor : Colors.white,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    descricao,
                    style: TextStyle(
                      fontSize: 14,
                      color: isSelected ? cor.withValues(alpha: 0.8) : Colors.grey[400],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildVoteButton() {
    final isDisabled = _votoSelecionado == VotoOpcao.nenhum || _isVoting;

    return SizedBox(
      width: double.infinity,
      height: 56,
      child: ElevatedButton(
        onPressed: isDisabled ? null : _submitVote,
        style: ElevatedButton.styleFrom(
          backgroundColor: isDisabled ? Colors.grey[700] : const Color(0xFF58a6ff),
          disabledBackgroundColor: Colors.grey[700],
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          elevation: isDisabled ? 0 : 4,
        ),
        child: _isVoting
            ? const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      color: Colors.white,
                      strokeWidth: 2,
                    ),
                  ),
                  SizedBox(width: 12),
                  Text(
                    'Enviando voto...',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
                ],
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.check_circle, color: Colors.white, size: 20),
                  const SizedBox(width: 8),
                  Text(
                    isDisabled && !_isVoting ? 'Selecione uma opção' : 'CONFIRMAR VOTO',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: isDisabled && !_isVoting ? Colors.grey[400] : Colors.white,
                    ),
                  ),
                ],
              ),
      ),
    );
  }

  Widget _buildEstatisticasCard() {
    return Card(
      color: const Color(0xFF21262d),
      elevation: 4,
      child: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.bar_chart, color: Colors.white, size: 20),
                const SizedBox(width: 8),
                const Text(
                  'Votos em Tempo Real',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                if (_isLoadingStats)
                  const Padding(
                    padding: EdgeInsets.only(left: 12),
                    child: SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.blue,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            if (_estatisticas != null) ...[
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _buildStatItem(
                    'SIM',
                    _estatisticas!['sim']?.toString() ?? '0',
                    Colors.green,
                    Icons.thumb_up,
                  ),
                  _buildStatItem(
                    'NÃO',
                    _estatisticas!['nao']?.toString() ?? '0',
                    Colors.red,
                    Icons.thumb_down,
                  ),
                  _buildStatItem(
                    'ABSTENÇÃO',
                    _estatisticas!['abstencao']?.toString() ?? '0',
                    Colors.orange,
                    Icons.remove_circle_outline,
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFF0d1117),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.grey[700]!),
                ),
                child: Text(
                  'Total de votos: ${_estatisticas!['total']?.toString() ?? '0'}',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Colors.white70,
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ] else ...[
              const Center(
                child: Text(
                  'Carregando estatísticas...',
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 14,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildStatItem(String label, String count, Color color, IconData icon) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 4),
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 24),
            const SizedBox(height: 8),
            Text(
              count,
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: color,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                color: color.withValues(alpha: 0.8),
                fontWeight: FontWeight.w600,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  /// Obter cor do indicador de conexão
  Color _getConnectionColor() {
    if (_webSocketService.isConnected) {
      return const Color(0xFF2EA043); // Verde - WebSocket conectado
    } else if (_isUserConnected) {
      return const Color(0xFFF08833); // Laranja - Apenas HTTP
    } else {
      return const Color(0xFFDA3633); // Vermelho - Offline
    }
  }

  /// Obter ícone do indicador de conexão
  IconData _getConnectionIcon() {
    if (_webSocketService.isConnected) {
      return Icons.flash_on; // WebSocket em tempo real
    } else if (_isUserConnected) {
      return Icons.sync; // Sincronização HTTP
    } else {
      return Icons.wifi_off; // Offline
    }
  }

  /// Obter texto do indicador de conexão
  String _getConnectionText() {
    if (_webSocketService.isConnected) {
      return 'Tempo Real';
    } else if (_isUserConnected) {
      return 'Online';
    } else {
      return 'Offline';
    }
  }
}