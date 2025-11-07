import 'package:flutter/material.dart';

class CustomToastService {
  static OverlayEntry? _overlayEntry;
  static bool _isShowing = false;

  /// Mostrar toast customizado sem gradiente
  static void showVoteToast(
    BuildContext context,
    String message,
    String voto,
  ) {
    if (_isShowing) {
      _hideToast();
    }

    Color backgroundColor;
    IconData icon;
    Color iconColor = Colors.white;

    switch (voto) {
      case 'SIM':
        backgroundColor = const Color(0xFF2EA043); // Verde da paleta
        icon = Icons.thumb_up_rounded;
        break;
      case 'NÃO':
        backgroundColor = const Color(0xFFDA3633); // Vermelho da paleta
        icon = Icons.thumb_down_rounded;
        break;
      case 'ABSTENÇÃO':
        backgroundColor = const Color(0xFFF08833); // Laranja da paleta
        icon = Icons.remove_circle_outline_rounded;
        break;
      default:
        backgroundColor = const Color(0xFF58a6ff); // Azul da paleta
        icon = Icons.info_outline_rounded;
    }

    _showCustomToast(
      context,
      message,
      backgroundColor,
      icon,
      iconColor,
    );
  }

  /// Mostrar toast de conexão
  static void showConnectionToast(
    BuildContext context,
    String message, {
    required bool isPositive,
  }) {
    if (_isShowing) {
      _hideToast();
    }

    _showCustomToast(
      context,
      message,
      isPositive
        ? const Color(0xFF2EA043) // Verde da paleta
        : const Color(0xFF6b7280), // Cinza da paleta
      isPositive ? Icons.wifi_rounded : Icons.wifi_off_rounded,
      Colors.white,
    );
  }

  /// Mostrar toast de erro
  static void showErrorToast(
    BuildContext context,
    String message,
  ) {
    if (_isShowing) {
      _hideToast();
    }

    _showCustomToast(
      context,
      message,
      const Color(0xFFDA3633), // Vermelho da paleta
      Icons.error_outline_rounded,
      Colors.white,
    );
  }

  /// Mostrar toast informativo
  static void showInfoToast(
    BuildContext context,
    String message,
  ) {
    if (_isShowing) {
      _hideToast();
    }

    _showCustomToast(
      context,
      message,
      const Color(0xFF58a6ff), // Azul da paleta
      Icons.info_outline_rounded,
      Colors.white,
    );
  }

  /// Implementação base do toast customizado
  static void _showCustomToast(
    BuildContext context,
    String message,
    Color backgroundColor,
    IconData icon,
    Color iconColor,
  ) {
    final overlay = Overlay.of(context);
    _isShowing = true;

    _overlayEntry = OverlayEntry(
      builder: (context) => Positioned(
        top: MediaQuery.of(context).padding.top + 20,
        right: 20,
        left: 20,
        child: Material(
          color: Colors.transparent,
          child: TweenAnimationBuilder<double>(
            duration: const Duration(milliseconds: 300), // Animação mais suave
            tween: Tween(begin: 0.0, end: 1.0),
            builder: (context, value, child) => Transform.translate(
              offset: Offset(100 * (1 - value), 0), // Direita para esquerda
              child: Opacity(
                opacity: value,
                child: child,
              ),
            ),
            child: Container(
              constraints: const BoxConstraints(maxWidth: 400),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: backgroundColor, // Cor sólida, sem gradiente
                borderRadius: BorderRadius.circular(8),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.2),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 24,
                    height: 24,
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(
                      icon,
                      color: iconColor,
                      size: 16,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      message,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );

    overlay.insert(_overlayEntry!);

    // Auto-remover após 2.5 segundos (mais rápido)
    Future.delayed(const Duration(milliseconds: 2500), () {
      _hideToast();
    });
  }

  /// Esconder toast atual
  static void _hideToast() {
    if (_overlayEntry != null && _isShowing) {
      _overlayEntry!.remove();
      _overlayEntry = null;
      _isShowing = false;
    }
  }

  /// Verificar se um toast está sendo exibido
  static bool get isShowing => _isShowing;

  /// Limpar qualquer toast ativo
  static void clear() {
    _hideToast();
  }
}