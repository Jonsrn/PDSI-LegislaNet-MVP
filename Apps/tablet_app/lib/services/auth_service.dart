import 'dart:convert';
import 'package:http/http.dart' as http;

class AuthService {
  // Backend dedicado do tablet na porta 3003
  static String get baseUrl {
    return 'http://127.0.0.1:3003';
  }
  static String? _token;
  static Map<String, dynamic>? _currentUser;

  static Map<String, dynamic>? get currentUser => _currentUser;
  static String? get token => _token;
  static bool get isLoggedIn => _token != null && _currentUser != null;

  /// Faz login do vereador e armazena os dados
  static Future<Map<String, dynamic>> login(String email, String password) async {
    final url = '$baseUrl/api/auth/login';
    print('🔐 [AuthService] Tentando login em: $url');
    print('📧 [AuthService] Email: $email');

    try {
      final response = await http.post(
        Uri.parse(url),
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'email': email,
          'password': password,
        }),
      );

      print('📡 [AuthService] Status da resposta: ${response.statusCode}');
      print('📄 [AuthService] Response body: ${response.body}');

      final responseData = jsonDecode(response.body);

      if (response.statusCode == 200) {
        _token = responseData['token'];
        _currentUser = responseData['user'];

        // Verificar se o usuário é um vereador
        if (_currentUser?['role'] != 'vereador') {
          throw Exception('Acesso restrito a vereadores');
        }

        return {
          'success': true,
          'user': _currentUser,
          'token': _token,
        };
      } else {
        return {
          'success': false,
          'error': responseData['error'] ?? 'Erro desconhecido',
        };
      }
    } catch (e) {
      print('❌ [AuthService] Erro de conexão: $e');
      return {
        'success': false,
        'error': 'Erro de conexão: ${e.toString()}',
      };
    }
  }

  /// Busca os dados detalhados do vereador logado
  static Future<Map<String, dynamic>?> getVereadorDetails() async {
    if (!isLoggedIn) {
      return null;
    }

    try {
      print('🔍 Buscando dados do vereador em: $baseUrl/api/vereador/profile');
      final response = await http.get(
        Uri.parse('$baseUrl/api/vereador/profile'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $_token',
        },
      );

      print('📡 Status da resposta: ${response.statusCode}');
      print('📄 Response body: ${response.body}');

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        print('❌ Erro ao buscar perfil: ${response.statusCode} - ${response.body}');
      }
    } catch (e) {
      print('❌ Erro ao buscar detalhes do vereador: $e');
    }
    return null;
  }

  /// Faz logout e limpa os dados armazenados
  static Future<void> logout() async {
    if (_token != null) {
      try {
        await http.post(
          Uri.parse('$baseUrl/auth/logout'),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $_token',
          },
        );
      } catch (e) {
        print('Erro ao fazer logout no servidor: $e');
      }
    }

    _token = null;
    _currentUser = null;
  }

  /// Verifica se o token ainda é válido
  static Future<bool> validateToken() async {
    if (!isLoggedIn) return false;

    try {
      final response = await http.get(
        Uri.parse('$baseUrl/api/vereador/profile'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $_token',
        },
      );

      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }

  /// Busca pautas da câmara
  static Future<Map<String, dynamic>?> getPautas({int page = 1, int limit = 50}) async {
    if (!isLoggedIn) return null;

    try {
      print('🔍 Buscando pautas: $baseUrl/api/pautas?page=$page&limit=$limit');
      final response = await http.get(
        Uri.parse('$baseUrl/api/pautas?page=$page&limit=$limit'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $_token',
        },
      );

      print('📡 Status pautas: ${response.statusCode}');
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        print('❌ Erro ao buscar pautas: ${response.statusCode} - ${response.body}');
      }
    } catch (e) {
      print('❌ Erro ao buscar pautas: $e');
    }
    return null;
  }

  /// Registra voto do vereador
  static Future<Map<String, dynamic>?> registrarVoto(String pautaId, String voto) async {
    if (!isLoggedIn) return null;

    try {
      print('🗳️ Registrando voto: $voto na pauta $pautaId');
      final response = await http.post(
        Uri.parse('$baseUrl/api/votos'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $_token',
        },
        body: jsonEncode({
          'pauta_id': pautaId,
          'voto': voto,
        }),
      );

      print('📡 Status voto: ${response.statusCode}');
      print('📄 Response voto: ${response.body}');

      if (response.statusCode == 200 || response.statusCode == 201) {
        return jsonDecode(response.body);
      } else {
        print('❌ Erro ao registrar voto: ${response.statusCode} - ${response.body}');
        final errorData = jsonDecode(response.body);
        return {'success': false, 'error': errorData['error'] ?? 'Erro ao registrar voto'};
      }
    } catch (e) {
      print('❌ Erro ao registrar voto: $e');
      return {'success': false, 'error': 'Erro de conexão: $e'};
    }
  }

  /// Busca votos do vereador
  static Future<Map<String, dynamic>?> getVotosVereador() async {
    if (!isLoggedIn) return null;

    try {
      print('🔍 Buscando votos do vereador: $baseUrl/api/votos/meus-votos');
      final response = await http.get(
        Uri.parse('$baseUrl/api/votos/meus-votos'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $_token',
        },
      );

      print('📡 Status votos: ${response.statusCode}');
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        print('❌ Erro ao buscar votos: ${response.statusCode} - ${response.body}');
      }
    } catch (e) {
      print('❌ Erro ao buscar votos: $e');
    }
    return null;
  }

  /// Busca estatísticas de uma pauta
  static Future<Map<String, dynamic>?> getEstatisticasPauta(String pautaId) async {
    if (!isLoggedIn) return null;

    try {
      print('📊 Buscando estatísticas da pauta: $baseUrl/api/votos/pauta/$pautaId/estatisticas');
      final response = await http.get(
        Uri.parse('$baseUrl/api/votos/pauta/$pautaId/estatisticas'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $_token',
        },
      );

      print('📡 Status estatísticas: ${response.statusCode}');
      print('📄 Response estatísticas: ${response.body}');

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        print('❌ Erro ao buscar estatísticas: ${response.statusCode} - ${response.body}');
      }
    } catch (e) {
      print('❌ Erro ao buscar estatísticas: $e');
    }
    return null;
  }

  /// Busca o voto específico do vereador em uma pauta
  static Future<Map<String, dynamic>?> getVotoEmPauta(String pautaId) async {
    if (!isLoggedIn) return null;

    try {
      print('🔍 Verificando voto em pauta: $baseUrl/api/votos/pauta/$pautaId');
      final response = await http.get(
        Uri.parse('$baseUrl/api/votos/pauta/$pautaId'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $_token',
        },
      );

      print('📡 Status voto em pauta: ${response.statusCode}');
      print('📄 Response voto em pauta: ${response.body}');

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        print('❌ Erro ao buscar voto em pauta: ${response.statusCode} - ${response.body}');
      }
    } catch (e) {
      print('❌ Erro ao buscar voto em pauta: $e');
    }
    return null;
  }
}