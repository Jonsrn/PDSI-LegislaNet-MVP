import 'package:flutter/material.dart';
import 'services/auth_service.dart';

// Definição da paleta de cores baseada no global.css
class AppColors {
  static const Color backgroundDark = Color(0xFF0D1117);
  static const Color backgroundLight = Color(0xFF161B22);
  static const Color cardBg = Color(0xFF161B22);
  static const Color hoverBg = Color(0xFF21262D);
  static const Color borderColor = Color(0xFF30363D);
  static const Color primaryText = Color(0xFFE6EDF3);
  static const Color secondaryText = Color(0xFF8B949E);
  static const Color accentBlue = Color(0xFF58A6FF);
  static const Color accentGreen = Color(0xFF2EA043);
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  bool _isPasswordVisible = false;
  bool _isLoading = false;
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  Future<void> _handleLogin() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text.trim();

    if (email.isEmpty || password.isEmpty) {
      _showError('Por favor, preencha todos os campos');
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      final result = await AuthService.login(email, password);

      if (result['success']) {
        if (!mounted) return;
        Navigator.of(context).pushReplacementNamed('/dashboard');
      } else {
        _showError(result['error'] ?? 'Erro desconhecido');
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: AppColors.accentBlue,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        // Background idêntico ao global.css (body::after)
        decoration: const BoxDecoration(
          color: AppColors.backgroundDark, // background-color base
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
            // Gradientes radiais adicionais como no CSS
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
                      const Color.fromRGBO(46, 160, 67, 0.05), // accent-green
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
                      const Color.fromRGBO(138, 58, 185, 0.04), // accent-purple
                      Colors.transparent,
                    ],
                    stops: const [0.0, 0.6],
                  ),
                ),
              ),
            ),
            // Conteúdo principal
            Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24.0),
                child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 400),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // --- Logo e Nome da Aplicação ---
                  _buildLogo(),
                  const SizedBox(height: 40),

                  // --- Card de Login ---
                  _buildLoginCard(),
                ],
              ),
            ),
          ),
        ),
          ],
        ),
      ),
    );
  }

  Widget _buildLogo() {
    return Column(
      children: [
        // Logo customizada com gradiente nativo do Flutter
        _buildCustomLogo(),
        const SizedBox(height: 12),
        const Text(
          'Legisla Net',
          style: TextStyle(
            color: AppColors.primaryText,
            fontSize: 22,
            fontWeight: FontWeight.w600,
            fontFamily: 'Inter',
          ),
        ),
      ],
    );
  }

  Widget _buildCustomLogo() {
    return SizedBox(
      width: 44,
      height: 40,
      child: CustomPaint(
        painter: LogoPainter(),
      ),
    );
  }

  Widget _buildLoginCard() {
    return Container(
      padding: const EdgeInsets.all(32.0),
      decoration: BoxDecoration(
        color: AppColors.cardBg.withValues(alpha: 0.85),
        borderRadius: BorderRadius.circular(8.0),
        border: Border.all(color: AppColors.borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Acesse sua conta',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppColors.primaryText,
              fontSize: 20,
              fontWeight: FontWeight.w600,
              fontFamily: 'Inter',
            ),
          ),
          const SizedBox(height: 24),
          // --- Campo de Email ---
          _buildEmailField(),
          const SizedBox(height: 16),
          // --- Campo de Senha ---
          _buildPasswordField(),
          const SizedBox(height: 8),
          _buildForgotPasswordLink(),
          const SizedBox(height: 24),
          // --- Botão de Entrar ---
          _buildLoginButton(),
        ],
      ),
    );
  }

  Widget _buildEmailField() {
    return TextFormField(
      controller: _emailController,
      keyboardType: TextInputType.emailAddress,
      style: const TextStyle(color: AppColors.primaryText, fontFamily: 'Inter'),
      decoration: InputDecoration(
        hintText: 'Digite seu email',
        prefixIcon: const Icon(
          Icons.email_outlined,
          color: AppColors.secondaryText,
          size: 20,
        ),
        // Estilos de decoração do input
        filled: true,
        fillColor: AppColors.hoverBg,
        hintStyle: const TextStyle(
          color: AppColors.secondaryText,
          fontFamily: 'Inter',
        ),
        contentPadding: const EdgeInsets.symmetric(
          vertical: 14,
          horizontal: 12,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(6.0),
          borderSide: const BorderSide(color: AppColors.borderColor),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(6.0),
          borderSide: const BorderSide(color: AppColors.accentBlue),
        ),
      ),
    );
  }

  Widget _buildPasswordField() {
    return TextFormField(
      controller: _passwordController,
      obscureText: !_isPasswordVisible,
      style: const TextStyle(color: AppColors.primaryText, fontFamily: 'Inter'),
      decoration: InputDecoration(
        hintText: 'Digite sua senha',
        prefixIcon: const Icon(
          Icons.lock_outline,
          color: AppColors.secondaryText,
          size: 20,
        ),
        suffixIcon: IconButton(
          icon: Icon(
            _isPasswordVisible
                ? Icons.visibility_off_outlined
                : Icons.visibility_outlined,
            color: AppColors.secondaryText,
            size: 20,
          ),
          onPressed: () {
            setState(() {
              _isPasswordVisible = !_isPasswordVisible;
            });
          },
        ),
        filled: true,
        fillColor: AppColors.hoverBg,
        hintStyle: const TextStyle(
          color: AppColors.secondaryText,
          fontFamily: 'Inter',
        ),
        contentPadding: const EdgeInsets.symmetric(
          vertical: 14,
          horizontal: 12,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(6.0),
          borderSide: const BorderSide(color: AppColors.borderColor),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(6.0),
          borderSide: const BorderSide(color: AppColors.accentBlue),
        ),
      ),
    );
  }

  Widget _buildForgotPasswordLink() {
    return Align(
      alignment: Alignment.centerRight,
      child: TextButton(
        onPressed: () {
          // Funcionalidade de recuperação de senha será implementada futuramente
        },
        child: const Text(
          'Esqueceu sua senha?',
          style: TextStyle(
            color: AppColors.accentBlue,
            fontSize: 14,
            fontFamily: 'Inter',
          ),
        ),
      ),
    );
  }

  Widget _buildLoginButton() {
    return ElevatedButton(
      onPressed: _isLoading ? null : _handleLogin,
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.accentGreen, // Cor do botão da web
        padding: const EdgeInsets.symmetric(vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6.0)),
      ),
      child: _isLoading
          ? const SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(
                color: Colors.white,
                strokeWidth: 2,
              ),
            )
          : const Text(
              'Entrar',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Colors.white,
                fontFamily: 'Inter',
              ),
            ),
    );
  }
}

// CustomPainter para desenhar a logo com gradiente nativo
class LogoPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    // Criar o gradiente igual ao SVG
    final gradient = LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [
        AppColors.accentBlue,  // #58a6ff
        AppColors.accentGreen, // #2ea043
      ],
    );

    final paint = Paint()
      ..shader = gradient.createShader(Rect.fromLTWH(0, 0, size.width, size.height));

    // Desenhar as três colunas (como no SVG original)
    // Coluna 1: M 8 5 V 35 H 14 V 5 Z
    final column1 = Path()
      ..moveTo(8, 5)
      ..lineTo(8, 35)
      ..lineTo(14, 35)
      ..lineTo(14, 5)
      ..close();

    // Coluna 2: M 19 5 V 35 H 25 V 5 Z
    final column2 = Path()
      ..moveTo(19, 5)
      ..lineTo(19, 35)
      ..lineTo(25, 35)
      ..lineTo(25, 5)
      ..close();

    // Coluna 3: M 30 5 V 35 H 36 V 5 Z
    final column3 = Path()
      ..moveTo(30, 5)
      ..lineTo(30, 35)
      ..lineTo(36, 35)
      ..lineTo(36, 5)
      ..close();

    // Base: M 5 35 H 39 V 40 H 5 Z
    final base = Path()
      ..moveTo(5, 35)
      ..lineTo(39, 35)
      ..lineTo(39, 40)
      ..lineTo(5, 40)
      ..close();

    // Desenhar todos os elementos
    canvas.drawPath(column1, paint);
    canvas.drawPath(column2, paint);
    canvas.drawPath(column3, paint);
    canvas.drawPath(base, paint);
  }

  @override
  bool shouldRepaint(CustomPainter oldDelegate) => false;
}
