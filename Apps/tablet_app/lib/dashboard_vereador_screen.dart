import 'package:flutter/material.dart';
import 'votacao_pauta_screen.dart'; // Importação Relativa da nova tela
import 'services/auth_service.dart';
import 'services/websocket_service.dart';
import 'dart:async';
import 'package:url_launcher/url_launcher.dart';

enum VotoTipo { sim, nao, abstencao, naoVotado }
enum TabState { pendente, emVotacao, finalizada }

class DashboardVereadorScreen extends StatefulWidget {
  const DashboardVereadorScreen({super.key});

  @override
  State<DashboardVereadorScreen> createState() =>
      _DashboardVereadorScreenState();
}

class _DashboardVereadorScreenState extends State<DashboardVereadorScreen> {
  TabState _currentTab = TabState.pendente;
  final bool _isUserConnected = true; // Flag de conexão do usuário
  Map<String, dynamic>? _vereadorData;
  bool _isLoadingVereador = true;
  List<Map<String, dynamic>> _pautasPendentes = [];
  List<Map<String, dynamic>> _pautasEmVotacao = [];
  List<Map<String, dynamic>> _pautasFinalizadas = [];
  bool _isLoadingPautas = true;
  final Map<String, Map<String, dynamic>> _votosVereador = {}; // Cache dos votos do vereador

  // WebSocket para notificações em tempo real
  final WebSocketService _webSocketService = WebSocketService.instance;
  StreamSubscription<Map<String, dynamic>>? _pautaStatusSubscription;
  StreamSubscription<Map<String, dynamic>>? _iniciarVotacaoSubscription;

  @override
  void initState() {
    super.initState();
    _loadVereadorData();
    _loadPautas();
    _connectWebSocket();
    _setupWebSocketListeners();
  }

  /// Conecta ao WebSocket para receber notificações em tempo real
  Future<void> _connectWebSocket() async {
    try {
      await _webSocketService.connect();
      print('✅ WebSocket conectado com sucesso no dashboard');
    } catch (e) {
      print('❌ Erro ao conectar WebSocket no dashboard: $e');
    }
  }

  @override
  void dispose() {
    _pautaStatusSubscription?.cancel();
    _iniciarVotacaoSubscription?.cancel();
    super.dispose();
  }

  /// Configura os listeners do WebSocket para notificações em tempo real
  void _setupWebSocketListeners() {
    // Escutar mudanças de status das pautas
    _pautaStatusSubscription = _webSocketService.pautaStatusUpdates.listen((data) {
      print('📢 Notificação de mudança de status recebida: $data');
      _handlePautaStatusChange(data);
    });

    // Escutar evento de iniciar votação (abre tela de votação automaticamente)
    _iniciarVotacaoSubscription = _webSocketService.iniciarVotacaoEvents.listen((data) {
      print('🗳️ Evento de iniciar votação recebido: $data');
      _handleIniciarVotacao(data);
    });
  }

  /// Processa mudanças de status das pautas
  void _handlePautaStatusChange(Map<String, dynamic> data) {
    final pautaId = data['pautaId']?.toString();
    final newStatus = data['newStatus']?.toString();

    if (pautaId == null || newStatus == null) {
      print('⚠️ Dados incompletos na notificação de status: $data');
      return;
    }

    print('🔄 Processando mudança de status: Pauta $pautaId → $newStatus');

    if (newStatus.toLowerCase() == 'finalizada') {
      _movePautaToFinalizada(pautaId, data);
    }
  }

  /// Move pauta de "Em Votação" para "Finalizada" e atualiza dados
  void _movePautaToFinalizada(String pautaId, Map<String, dynamic> statusData) {
    // Encontrar a pauta em "Em Votação"
    final pautaIndex = _pautasEmVotacao.indexWhere((p) => p['id'] == pautaId);

    if (pautaIndex != -1) {
      final pauta = _pautasEmVotacao[pautaIndex];

      // Atualizar status e resultado
      pauta['status'] = 'Finalizada';
      if (statusData['resultado'] != null) {
        pauta['resultado_votacao'] = statusData['resultado'];
      }

      setState(() {
        // Remover de "Em Votação"
        _pautasEmVotacao.removeAt(pautaIndex);

        // Adicionar em "Finalizadas"
        _pautasFinalizadas.insert(0, pauta); // Inserir no início da lista
      });

      // Buscar estatísticas da pauta finalizada
      _loadVotosVereadorForPauta(pautaId);

      print('✅ Pauta $pautaId movida para "Finalizadas" com sucesso');
    } else {
      print('⚠️ Pauta $pautaId não encontrada em "Em Votação"');
    }
  }

  /// Processa evento de iniciar votação (abre tela de votação automaticamente)
  void _handleIniciarVotacao(Map<String, dynamic> data) {
    final pautaId = data['pautaId']?.toString();
    final pautaNome = data['pautaNome']?.toString() ?? 'Pauta';

    if (pautaId == null) {
      print('⚠️ Evento de iniciar votação sem pautaId: $data');
      return;
    }

    print('🗳️ Processando solicitação de iniciar votação: $pautaNome (ID: $pautaId)');

    // Buscar a pauta completa na lista de pautas em votação
    final pauta = _pautasEmVotacao.firstWhere(
      (p) => p['id'] == pautaId,
      orElse: () => <String, dynamic>{},
    );

    if (pauta.isEmpty) {
      print('⚠️ Pauta $pautaId não encontrada na lista de pautas em votação');
      // Recarregar pautas para garantir que temos a atualização
      _loadPautas();
      return;
    }

    // Navegar para a tela de votação automaticamente
    if (!mounted) return;

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => VotacaoPautaScreen(pauta: pauta),
      ),
    ).then((_) {
      // Atualizar dados quando voltar da tela de votação
      _loadPautas();
    });

    print('✅ Navegado para tela de votação da pauta: $pautaNome');
  }

  /// Carrega votos do vereador para uma pauta específica
  Future<void> _loadVotosVereadorForPauta(String pautaId) async {
    try {
      print('🗳️ Carregando estatísticas da pauta finalizada: $pautaId');

      final estatisticas = await AuthService.getEstatisticasPauta(pautaId);
      if (estatisticas != null) {
        final votosResponse = await AuthService.getVotosVereador();
        if (votosResponse != null) {
          final votosPorPauta = votosResponse['votosPorPauta'] as Map<String, dynamic>? ?? {};
          final votoVereador = votosPorPauta[pautaId];

          setState(() {
            _votosVereador[pautaId] = {
              'voto': votoVereador?['voto'],
              'estatisticas': estatisticas['estatisticas'],
              'resultado': estatisticas['pauta']?['resultado_votacao'],
            };
          });

          print('✅ Estatísticas carregadas para pauta $pautaId');
        }
      }
    } catch (e) {
      print('❌ Erro ao carregar estatísticas da pauta $pautaId: $e');
    }
  }

  Future<void> _loadVereadorData() async {
    try {
      final vereadorData = await AuthService.getVereadorDetails();
      if (mounted) {
        setState(() {
          _vereadorData = vereadorData;
          _isLoadingVereador = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoadingVereador = false;
        });
      }
    }
  }

  Future<void> _loadPautas() async {
    try {
      setState(() {
        _isLoadingPautas = true;
      });

      print('🔗 Carregando todas as pautas da câmara via backend tablet...');

      // Buscar todas as pautas usando o backend do tablet
      List<Map<String, dynamic>> todasPautas = [];
      int currentPage = 1;
      bool hasMorePages = true;

      while (hasMorePages) {
        print('📡 Carregando página $currentPage...');

        final response = await AuthService.getPautas(page: currentPage, limit: 50);

        if (response != null && response['data'] != null) {
          final pautasData = response['data'];

          // Extrair pautas de todos os status
          List<Map<String, dynamic>> paginaPautas = [];
          if (pautasData['pendentes'] != null) {
            paginaPautas.addAll(List<Map<String, dynamic>>.from(pautasData['pendentes']));
          }
          if (pautasData['emVotacao'] != null) {
            paginaPautas.addAll(List<Map<String, dynamic>>.from(pautasData['emVotacao']));
          }
          if (pautasData['finalizadas'] != null) {
            paginaPautas.addAll(List<Map<String, dynamic>>.from(pautasData['finalizadas']));
          }

          todasPautas.addAll(paginaPautas);

          // Verificar se há mais páginas
          final pagination = response['pagination'];
          if (pagination != null) {
            final totalPages = pagination['totalPages'] ?? 1;
            hasMorePages = currentPage < totalPages;
            print('📖 Página $currentPage de $totalPages (${paginaPautas.length} pautas)');
          } else {
            hasMorePages = false;
          }

          currentPage++;
        } else {
          print('❌ Erro ao carregar pautas da página $currentPage');
          hasMorePages = false;
        }
      }

      print('📋 Total de pautas carregadas: ${todasPautas.length}');

      if (mounted) {
        setState(() {
          _pautasPendentes = todasPautas
              .where((pauta) => pauta['status']?.toLowerCase() == 'pendente')
              .toList();
          _pautasEmVotacao = todasPautas
              .where((pauta) => pauta['status']?.toLowerCase() == 'em votação')
              .toList();
          _pautasFinalizadas = todasPautas
              .where((pauta) => pauta['status']?.toLowerCase() == 'finalizada')
              .toList();
          _isLoadingPautas = false;
        });

        print('✅ Pautas organizadas:');
        print('   - Pendentes: ${_pautasPendentes.length}');
        print('   - Em Votação: ${_pautasEmVotacao.length}');
        print('   - Finalizadas: ${_pautasFinalizadas.length}');

        // Carregar votos do vereador para pautas em votação e finalizadas
        await _loadVotosVereador();
      }
    } catch (e) {
      print('💥 Erro ao carregar pautas: $e');
      if (mounted) {
        setState(() {
          _isLoadingPautas = false;
        });

        // Mostrar erro na interface
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erro ao carregar pautas: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _loadVotosVereador() async {
    try {
      print('🗳️ Carregando votos do vereador via backend tablet...');

      // Buscar todos os votos do vereador de uma vez
      final votosResponse = await AuthService.getVotosVereador();

      if (votosResponse != null) {
        final votosPorPauta = votosResponse['votosPorPauta'] as Map<String, dynamic>? ?? {};

        // Pautas que precisam de estatísticas (finalizadas)
        final pautasFinalizadasIds = _pautasFinalizadas.map((p) => p['id']).where((id) => id != null).toList();

        // Carregar estatísticas para pautas finalizadas
        for (final pautaId in pautasFinalizadasIds) {
          try {
            final estatisticas = await AuthService.getEstatisticasPauta(pautaId);
            if (estatisticas != null) {
              // Combinar voto do vereador com estatísticas
              final votoVereador = votosPorPauta[pautaId];

              setState(() {
                _votosVereador[pautaId] = {
                  'voto': votoVereador?['voto'],
                  'estatisticas': estatisticas['estatisticas'],
                  'resultado': estatisticas['pauta']?['resultado_votacao'],
                };
              });
            }
          } catch (e) {
            print('Erro ao carregar estatísticas da pauta $pautaId: $e');
          }
        }

        // Para pautas em votação, apenas o voto do vereador
        final pautasEmVotacaoIds = _pautasEmVotacao.map((p) => p['id']).where((id) => id != null).toList();
        for (final pautaId in pautasEmVotacaoIds) {
          final votoVereador = votosPorPauta[pautaId];
          if (votoVereador != null) {
            setState(() {
              _votosVereador[pautaId] = {
                'voto': votoVereador['voto'],
              };
            });
          }
        }

        print('✅ Votos do vereador carregados: ${_votosVereador.length} pautas com voto');
      }
    } catch (e) {
      print('💥 Erro ao carregar votos do vereador: $e');
    }
  }

  Future<void> _openPautaPDF(String? anexoUrl) async {
    if (anexoUrl == null || anexoUrl.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Esta pauta não possui arquivo PDF anexado'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    try {
      final uri = Uri.parse(anexoUrl);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        throw 'Não foi possível abrir o PDF';
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Erro ao abrir PDF: $e'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  void _handlePautaTap(Map<String, dynamic> pauta, String status) async {
    if (status.toLowerCase() == 'pendente') {
      // Pautas pendentes: abrir PDF
      _openPautaPDF(pauta['anexo_url']);
    } else if (status.toLowerCase() == 'em votação') {
      // Pautas em votação: ir para tela de votação
      final result = await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (context) => VotacaoPautaScreen(pauta: pauta),
        ),
      );

      // Se houve mudança (voto registrado), recarregar dados
      if (result == true) {
        print('🔄 Recarregando dados após votação...');
        await _loadVotosVereador();
        // Forçar rebuild da interface para mostrar a atualização
        setState(() {});
      }
    }
    // Pautas finalizadas: não fazem nada (apenas visualização)
  }

  VotoTipo _getVotoFromData(String? pautaId) {
    if (pautaId == null) return VotoTipo.naoVotado;

    final votoData = _votosVereador[pautaId];
    if (votoData == null) return VotoTipo.naoVotado;

    switch (votoData['voto']) {
      case 'SIM':
        return VotoTipo.sim;
      case 'NÃO':
        return VotoTipo.nao;
      case 'ABSTENÇÃO':
        return VotoTipo.abstencao;
      default:
        return VotoTipo.naoVotado;
    }
  }

  String _getStatusFromResult(Map<String, dynamic> pauta) {
    final resultado = pauta['resultado_votacao'];
    if (resultado == null) return 'Finalizada';

    switch (resultado) {
      case 'Aprovada':
        return 'Aprovada';
      case 'Reprovada':
        return 'Reprovada';
      default:
        return 'Finalizada';
    }
  }

  Color _getStatusColor(Map<String, dynamic> pauta) {
    final resultado = pauta['resultado_votacao'];

    switch (resultado) {
      case 'Aprovada':
        return const Color(0xFF2EA043); // Verde
      case 'Reprovada':
        return const Color(0xFFDA3633); // Vermelho
      case 'Abstenção':
      case 'Empate':
        return const Color(0xFFF08833); // Laranja
      default:
        return const Color(0xFF6e7681); // Cinza para casos indefinidos
    }
  }

  Future<void> _handleLogout() async {
    await AuthService.logout();
    if (mounted) {
      Navigator.of(context).pushNamedAndRemoveUntil('/', (route) => false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        // Background idêntico ao login (novo padrão)
        decoration: const BoxDecoration(
          color: Color(0xFF0d1117), // background-dark
          gradient: LinearGradient(
            begin: Alignment(-0.7071, -0.7071), // 135deg
            end: Alignment(0.7071, 0.7071),
            colors: [
              Color.fromRGBO(88, 166, 255, 0.08),  // accent-blue 0%
              Color.fromRGBO(46, 160, 67, 0.06),   // accent-green 25%
              Color.fromRGBO(138, 58, 185, 0.05),  // accent-purple 50%
              Color.fromRGBO(240, 136, 51, 0.07),  // accent-orange 75%
              Color.fromRGBO(88, 166, 255, 0.04),  // accent-blue 100%
            ],
            stops: [0.0, 0.25, 0.5, 0.75, 1.0],
          ),
        ),
        child: Stack(
          children: [
            // Gradientes radiais adicionais
            Positioned(
              left: MediaQuery.of(context).size.width * 0.2 - 200,
              top: MediaQuery.of(context).size.height * 0.3 - 200,
              child: Container(
                width: 400,
                height: 400,
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: Alignment.center,
                    radius: 0.6,
                    colors: [
                      const Color.fromRGBO(46, 160, 67, 0.05),
                      Colors.transparent,
                    ],
                    stops: const [0.0, 0.6],
                  ),
                ),
              ),
            ),
            Positioned(
              left: MediaQuery.of(context).size.width * 0.8 - 200,
              top: MediaQuery.of(context).size.height * 0.7 - 200,
              child: Container(
                width: 400,
                height: 400,
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: Alignment.center,
                    radius: 0.6,
                    colors: [
                      const Color.fromRGBO(138, 58, 185, 0.04),
                      Colors.transparent,
                    ],
                    stops: const [0.0, 0.6],
                  ),
                ),
              ),
            ),
            // Conteúdo principal
            SafeArea(
              child: Column(
                children: [
                  _buildHeader(),
                  const SizedBox(height: 24),
                  _buildTabButtons(),
                  const SizedBox(height: 24),
                  _buildCurrentView(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.all(16.0),
      margin: const EdgeInsets.symmetric(horizontal: 16.0),
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color, // Cor do card vinda do tema
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 35,
            backgroundColor: Colors.grey[600],
            child: _isLoadingVereador
                ? const CircularProgressIndicator(
                    color: Colors.white,
                    strokeWidth: 2,
                  )
                : _vereadorData?['foto_url'] != null && _vereadorData!['foto_url'].isNotEmpty
                    ? ClipOval(
                        child: Image.network(
                          _vereadorData!['foto_url'],
                          width: 70,
                          height: 70,
                          fit: BoxFit.cover,
                          errorBuilder: (context, error, stackTrace) {
                            return const Icon(
                              Icons.person,
                              size: 40,
                              color: Colors.white,
                            );
                          },
                        ),
                      )
                    : const Icon(
                        Icons.person,
                        size: 40,
                        color: Colors.white,
                      ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Boa tarde Vereador,',
                  style: TextStyle(fontSize: 16, color: Colors.white70),
                ),
                Text(
                  _vereadorData?['nome_parlamentar'] ??
                  AuthService.currentUser?['nome'] ??
                  'Carregando...',
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Câmara municipal, ${DateTime.now().day}/${DateTime.now().month}/${DateTime.now().year}',
                  style: const TextStyle(fontSize: 12, color: Colors.white60),
                ),
              ],
            ),
          ),
          // Flag de status de conexão
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            margin: const EdgeInsets.only(right: 12),
            decoration: BoxDecoration(
              color: _isUserConnected ? const Color(0xFF2EA043) : const Color(0xFFDA3633),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  _isUserConnected ? Icons.wifi : Icons.wifi_off,
                  color: Colors.white,
                  size: 16,
                ),
                const SizedBox(width: 6),
                Text(
                  _isUserConnected ? 'Online' : 'Offline',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: _handleLogout,
            icon: const Icon(Icons.exit_to_app, color: Color(0xFFF08833)),
          ),
        ],
      ),
    );
  }

  Widget _buildTabButtons() {
    return Container(
      decoration: BoxDecoration(
        color: const Color.fromRGBO(22, 27, 34, 0.85),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF30363d)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildTabButton('Pendente', TabState.pendente),
          _buildTabButton('Em Votação', TabState.emVotacao),
          _buildTabButton('Finalizada', TabState.finalizada),
        ],
      ),
    );
  }

  Widget _buildTabButton(String text, TabState tabState) {
    final isSelected = _currentTab == tabState;
    return GestureDetector(
      onTap: () {
        setState(() {
          _currentTab = tabState;
        });
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 12),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF58a6ff) : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          text,
          style: TextStyle(
            color: Colors.white,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
            fontSize: 14,
          ),
        ),
      ),
    );
  }

  Widget _buildCurrentView() {
    switch (_currentTab) {
      case TabState.pendente:
        return _buildPendenteView();
      case TabState.emVotacao:
        return _buildEmVotacaoView();
      case TabState.finalizada:
        return _buildFinalizadasView();
    }
  }

  Widget _buildPendenteView() {
    if (_isLoadingPautas) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFF58a6ff)),
      );
    }

    if (_pautasPendentes.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: const [
              Icon(
                Icons.check_circle_outline,
                size: 64,
                color: Colors.grey,
              ),
              SizedBox(height: 16),
              Text(
                'Nenhuma pauta pendente',
                style: TextStyle(
                  fontSize: 18,
                  color: Colors.grey,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Expanded(
      child: ListView.builder(
        padding: const EdgeInsets.symmetric(horizontal: 16.0),
        itemCount: _pautasPendentes.length,
        itemBuilder: (context, index) {
          final pauta = _pautasPendentes[index];
          return GestureDetector(
            onTap: () => _handlePautaTap(pauta, 'Pendente'),
            child: _VotacaoCard(
              tema: pauta['nome'] ?? 'Pauta sem nome',
              meuVoto: VotoTipo.naoVotado,
              status: 'Pendente',
              statusColor: const Color(0xFFF0E333), // Cor padronizada do HTML
              description: pauta['descricao'] ?? '',
              autor: pauta['autor'] ?? 'Não informado',
              showVoto: false, // Não mostrar voto para pautas pendentes
            ),
          );
        },
      ),
    );
  }

  Widget _buildEmVotacaoView() {
    if (_isLoadingPautas) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFF58a6ff)),
      );
    }

    if (_pautasEmVotacao.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: const [
              Icon(
                Icons.how_to_vote_outlined,
                size: 64,
                color: Colors.grey,
              ),
              SizedBox(height: 16),
              Text(
                'Nenhuma pauta em votação',
                style: TextStyle(
                  fontSize: 18,
                  color: Colors.grey,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Expanded(
      child: ListView.builder(
        padding: const EdgeInsets.symmetric(horizontal: 16.0),
        itemCount: _pautasEmVotacao.length,
        itemBuilder: (context, index) {
          final pauta = _pautasEmVotacao[index];
          return GestureDetector(
            onTap: () => _handlePautaTap(pauta, 'Em Votação'),
            child: _VotacaoCard(
              tema: pauta['nome'] ?? 'Pauta sem nome',
              meuVoto: _getVotoFromData(pauta['id']),
              status: 'Em Votação',
              statusColor: const Color(0xFF58a6ff), // Cor padronizada do HTML
              description: pauta['descricao'] ?? '',
              autor: pauta['autor'] ?? 'Não informado',
              showVoto: true, // Mostrar voto para pautas em votação
            ),
          );
        },
      ),
    );
  }

  Widget _buildFinalizadasView() {
    if (_isLoadingPautas) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFF58a6ff)),
      );
    }

    if (_pautasFinalizadas.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: const [
              Icon(
                Icons.task_alt_outlined,
                size: 64,
                color: Colors.grey,
              ),
              SizedBox(height: 16),
              Text(
                'Nenhuma pauta finalizada',
                style: TextStyle(
                  fontSize: 18,
                  color: Colors.grey,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Expanded(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Padding(
              padding: EdgeInsets.only(left: 8.0, bottom: 16.0),
              child: Text(
                'Votações Finalizadas',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFFe6edf3),
                ),
              ),
            ),
            Expanded(
              child: ListView.builder(
                itemCount: _pautasFinalizadas.length,
                itemBuilder: (context, index) {
                  final pauta = _pautasFinalizadas[index];
                  return _VotacaoCard(
                    tema: pauta['nome'] ?? 'Pauta sem nome',
                    meuVoto: _getVotoFromData(pauta['id']),
                    status: _getStatusFromResult(pauta),
                    statusColor: _getStatusColor(pauta),
                    description: pauta['descricao'] ?? '',
                    autor: pauta['autor'] ?? 'Não informado',
                    showVoto: true, // Mostrar voto para pautas finalizadas
                    estatisticas: _votosVereador[pauta['id']]?['estatisticas'],
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _VotacaoCard extends StatelessWidget {
  final String tema;
  final VotoTipo meuVoto;
  final String status;
  final Color statusColor;
  final String? description;
  final String? autor;
  final bool showVoto;
  final Map<String, dynamic>? estatisticas;

  const _VotacaoCard({
    required this.tema,
    required this.meuVoto,
    required this.status,
    required this.statusColor,
    this.description,
    this.autor,
    this.showVoto = true,
    this.estatisticas,
  });

  Map<String, dynamic> _getVotoStyle() {
    switch (meuVoto) {
      case VotoTipo.sim:
        return {'text': 'sim', 'color': const Color(0xFF2EA043)}; //
      case VotoTipo.nao:
        return {'text': 'não', 'color': const Color(0xFFDA3633)};
      case VotoTipo.abstencao:
        return {'text': 'abstenção', 'color': const Color(0xFFF08833)};
      case VotoTipo.naoVotado:
        return {'text': 'Não votado', 'color': Colors.grey[700]!}; //
    }
  }

  @override
  Widget build(BuildContext context) {
    final votoStyle = _getVotoStyle();
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    tema,
                    style: const TextStyle(
                      fontSize: 16,
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                // Para pautas finalizadas, mostrar status + situação
                if (status.toLowerCase() == 'aprovada' || status.toLowerCase() == 'reprovada') ...[
                  _buildBasicStatusBadge('FINALIZADA'),
                  const SizedBox(width: 8),
                  _buildStatusBadge(),
                ] else
                  _buildStatusBadge(),
              ],
            ),
            if (description?.isNotEmpty == true) ...
              [
                const SizedBox(height: 8),
                Text(
                  description!,
                  style: const TextStyle(
                    fontSize: 14,
                    color: Colors.white70,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            if (autor?.isNotEmpty == true) ...
              [
                const SizedBox(height: 8),
                Text(
                  'Autor: $autor',
                  style: const TextStyle(
                    fontSize: 12,
                    color: Colors.white60,
                  ),
                ),
              ],
            if (showVoto) ...
              [
                const SizedBox(height: 12),
                Row(
                  children: [
                    const Text(
                      'Meu voto: ',
                      style: TextStyle(fontSize: 14, color: Colors.white70),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: votoStyle['color'],
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        votoStyle['text'],
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            // Exibir estatísticas para pautas finalizadas
            if (estatisticas != null && (status == 'Aprovada' || status == 'Reprovada')) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.05),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _buildVoteCount('SIM', estatisticas!['sim'] ?? 0, const Color(0xFF2EA043)),
                    _buildVoteCount('NÃO', estatisticas!['nao'] ?? 0, const Color(0xFFDA3633)),
                    _buildVoteCount('ABSTENÇÃO', estatisticas!['abstencao'] ?? 0, const Color(0xFFF08833)),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildVoteCount(String label, int count, Color color) {
    return Column(
      children: [
        Text(
          count.toString(),
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            color: Colors.white60,
          ),
        ),
      ],
    );
  }

  Widget _buildBasicStatusBadge(String badgeStatus) {
    Color backgroundColor;
    Color textColor;
    Color borderColor;

    switch (badgeStatus.toLowerCase()) {
      case 'finalizada':
        backgroundColor = const Color.fromRGBO(46, 160, 67, 0.2);
        textColor = const Color(0xFF71e67f);
        borderColor = const Color.fromRGBO(46, 160, 67, 0.4);
        break;
      default:
        backgroundColor = const Color.fromRGBO(240, 227, 51, 0.2);
        textColor = const Color.fromRGBO(233, 241, 110, 1);
        borderColor = const Color.fromRGBO(240, 227, 51, 0.4);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: borderColor),
      ),
      child: Text(
        badgeStatus.toUpperCase(),
        style: TextStyle(
          color: textColor,
          fontSize: 10,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }

  Widget _buildStatusBadge() {
    // Para pautas finalizadas, mostrar situação (Aprovada/Reprovada) com cores específicas
    if (status.toLowerCase() == 'aprovada' || status.toLowerCase() == 'reprovada') {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        decoration: BoxDecoration(
          color: statusColor.withValues(alpha: 0.2),
          borderRadius: BorderRadius.circular(99),
          border: Border.all(color: statusColor.withValues(alpha: 0.6)),
        ),
        child: Text(
          status.toUpperCase(),
          style: TextStyle(
            color: statusColor,
            fontSize: 10,
            fontWeight: FontWeight.w600,
          ),
        ),
      );
    }

    // Para outros status, usar cores padrão
    Color backgroundColor;
    Color textColor;
    Color borderColor;

    switch (status.toLowerCase()) {
      case 'pendente':
        backgroundColor = const Color.fromRGBO(240, 227, 51, 0.2);
        textColor = const Color.fromRGBO(233, 241, 110, 1);
        borderColor = const Color.fromRGBO(240, 227, 51, 0.4);
        break;
      case 'em votação':
        backgroundColor = const Color.fromRGBO(88, 166, 255, 0.2);
        textColor = Colors.cyan;
        borderColor = const Color.fromRGBO(88, 166, 255, 0.4);
        break;
      case 'finalizada':
        backgroundColor = const Color.fromRGBO(46, 160, 67, 0.2);
        textColor = const Color(0xFF71e67f);
        borderColor = const Color.fromRGBO(46, 160, 67, 0.4);
        break;
      default:
        backgroundColor = const Color.fromRGBO(240, 227, 51, 0.2);
        textColor = const Color.fromRGBO(233, 241, 110, 1);
        borderColor = const Color.fromRGBO(240, 227, 51, 0.4);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: borderColor),
      ),
      child: Text(
        status.toUpperCase(),
        style: TextStyle(
          color: textColor,
          fontSize: 10,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }
}
