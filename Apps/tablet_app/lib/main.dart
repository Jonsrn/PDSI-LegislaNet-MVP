import 'package:flutter/material.dart';
import 'login_screen.dart'; // Importação Relativa
import 'dashboard_vereador_screen.dart';

void main() {
  runApp(const CamaraDigitalApp());
}

class CamaraDigitalApp extends StatelessWidget {
  const CamaraDigitalApp({super.key});

  @override
  Widget build(BuildContext context) {
    // Cores mais claras para o tema escuro
    const Color corFundoPrincipal = Color(
      0xFF1C1C1E,
    ); // Um cinza escuro, quase preto
    const Color corFundoCard = Color(
      0xFF2C2C2E,
    ); // Um cinza um pouco mais claro

    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Câmara Digital',
      theme: ThemeData(
        brightness: Brightness.dark,
        primarySwatch: Colors.blue,
        scaffoldBackgroundColor: corFundoPrincipal,
        fontFamily: 'Inter',
        cardTheme: CardThemeData(
          elevation: 0,
          color: corFundoCard,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: corFundoPrincipal,
          hintStyle: TextStyle(color: Colors.grey[600]),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8.0),
            borderSide: BorderSide(color: Colors.grey[800]!),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8.0),
            borderSide: const BorderSide(color: Color(0xFF58A6FF)),
          ),
        ),
      ),
      initialRoute: '/',
      routes: {
        '/': (context) => const LoginScreen(),
        '/dashboard': (context) => const DashboardVereadorScreen(),
      },
    );
  }
}
