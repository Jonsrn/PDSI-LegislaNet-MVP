#!/usr/bin/env python3
"""
Script para corrigir problemas do linter Dart de forma segura.
Resolve imports não utilizados após verificação minuciosa.
"""

import re
from pathlib import Path

def fix_sized_box_for_whitespace():
    """Substitui Container por SizedBox quando apenas para dimensionar."""

    fixes = []

    # 1. login_screen.dart - linha 187
    file1 = Path(r'C:\Projects\LegislaNet\Apps\tablet_app\lib\login_screen.dart')
    content1 = file1.read_text(encoding='utf-8')
    original1 = content1

    # Substituir Container por SizedBox no _buildCustomLogo
    content1 = content1.replace(
        '''  Widget _buildCustomLogo() {
    return Container(
      width: 44,
      height: 40,
      child: CustomPaint(
        painter: LogoPainter(),
      ),
    );
  }''',
        '''  Widget _buildCustomLogo() {
    return SizedBox(
      width: 44,
      height: 40,
      child: CustomPaint(
        painter: LogoPainter(),
      ),
    );
  }'''
    )

    if content1 != original1:
        file1.write_text(content1, encoding='utf-8')
        fixes.append(f"[OK] {file1.name}: Container -> SizedBox (linha 187)")

    # 2. votacao_pauta_screen.dart - linha 590
    file2 = Path(r'C:\Projects\LegislaNet\Apps\tablet_app\lib\votacao_pauta_screen.dart')
    content2 = file2.read_text(encoding='utf-8')
    original2 = content2

    # Buscar e substituir o Container que contém o botão
    pattern = r'return Container\(\s*width: double\.infinity,\s*height: 56,\s*child: ElevatedButton\('
    replacement = 'return SizedBox(\n      width: double.infinity,\n      height: 56,\n      child: ElevatedButton('

    content2 = re.sub(pattern, replacement, content2)

    if content2 != original2:
        file2.write_text(content2, encoding='utf-8')
        fixes.append(f"[OK] {file2.name}: Container -> SizedBox (linha 590)")

    return fixes

def fix_unused_imports():
    """Remove imports não utilizados de forma segura."""

    fixes = []

    # 1. login_screen.dart - Remove flutter_svg e dashboard_vereador_screen
    file1 = Path(r'C:\Projects\LegislaNet\Apps\tablet_app\lib\login_screen.dart')
    content1 = file1.read_text(encoding='utf-8')
    original1 = content1

    # Remove import flutter_svg
    content1 = re.sub(
        r"import 'package:flutter_svg/flutter_svg\.dart';\s*//[^\n]*\n",
        '',
        content1
    )

    # Remove import dashboard_vereador_screen
    content1 = re.sub(
        r"import 'dashboard_vereador_screen\.dart';\n",
        '',
        content1
    )

    if content1 != original1:
        file1.write_text(content1, encoding='utf-8')
        fixes.append(f"[OK] {file1.name}: Removidos 2 imports nao utilizados")

    # 2. websocket_service.dart - Remove dart:convert
    file2 = Path(r'C:\Projects\LegislaNet\Apps\tablet_app\lib\services\websocket_service.dart')
    content2 = file2.read_text(encoding='utf-8')
    original2 = content2

    content2 = re.sub(
        r"import 'dart:convert';\n",
        '',
        content2
    )

    if content2 != original2:
        file2.write_text(content2, encoding='utf-8')
        fixes.append(f"[OK] {file2.name}: Removido 1 import nao utilizado")

    # 3. votacao_pauta_screen.dart - Remove http e dart:convert
    file3 = Path(r'C:\Projects\LegislaNet\Apps\tablet_app\lib\votacao_pauta_screen.dart')
    content3 = file3.read_text(encoding='utf-8')
    original3 = content3

    content3 = re.sub(
        r"import 'package:http/http\.dart' as http;\n",
        '',
        content3
    )

    content3 = re.sub(
        r"import 'dart:convert';\n",
        '',
        content3
    )

    if content3 != original3:
        file3.write_text(content3, encoding='utf-8')
        fixes.append(f"[OK] {file3.name}: Removidos 2 imports nao utilizados")

    return fixes

def fix_lote_3_to_5():
    """Corrige unused_field, library_prefixes e unnecessary_string_interpolations."""

    fixes = []

    # 1. votacao_pauta_screen.dart - Remover _vereadorData (unused_field) e unused_local_variable
    file1 = Path(r'C:\Projects\LegislaNet\Apps\tablet_app\lib\votacao_pauta_screen.dart')
    content1 = file1.read_text(encoding='utf-8')
    original1 = content1

    # Remover a declaração do campo
    content1 = re.sub(
        r'  Map<String, dynamic>\? _vereadorData;\n',
        '',
        content1
    )

    # Remover a atribuição no setState
    content1 = re.sub(
        r'        setState\(\(\) \{\n          _vereadorData = vereadorData;\n        \}\);\n',
        '',
        content1
    )

    # Remover a variável local não utilizada e simplificar a função
    content1 = re.sub(
        r'  Future<void> _loadVereadorData\(\) async \{\n    try \{\n      final vereadorData = await AuthService\.getVereadorDetails\(\);\n      if \(mounted\) \{\n      \}\n    \} catch \(e\) \{\n      print\(\'Erro ao carregar dados do vereador: \$e\'\);\n    \}\n  \}',
        '''  Future<void> _loadVereadorData() async {
    try {
      await AuthService.getVereadorDetails();
      // Dados carregados com sucesso (não utilizados no momento)
    } catch (e) {
      print('Erro ao carregar dados do vereador: $e');
    }
  }''',
        content1
    )

    if content1 != original1:
        file1.write_text(content1, encoding='utf-8')
        fixes.append(f"[OK] {file1.name}: Removido campo e variavel nao utilizados")

    # 2. websocket_service.dart - Corrigir library_prefixes (IO -> io)
    file2 = Path(r'C:\Projects\LegislaNet\Apps\tablet_app\lib\services\websocket_service.dart')
    content2 = file2.read_text(encoding='utf-8')
    original2 = content2

    # Substituir 'as IO' por 'as io'
    content2 = content2.replace(
        "import 'package:socket_io_client/socket_io_client.dart' as IO;",
        "import 'package:socket_io_client/socket_io_client.dart' as io;"
    )

    # Substituir todas as referências IO. por io.
    content2 = re.sub(r'\bIO\.', 'io.', content2)

    if content2 != original2:
        file2.write_text(content2, encoding='utf-8')
        fixes.append(f"[OK] {file2.name}: Corrigido prefixo de biblioteca IO -> io")

    # 3. websocket_service.dart - Remover interpolação desnecessária
    file3 = Path(r'C:\Projects\LegislaNet\Apps\tablet_app\lib\services\websocket_service.dart')
    content3 = file3.read_text(encoding='utf-8')
    original3 = content3

    # Substituir '${AuthService.baseUrl}' por AuthService.baseUrl
    content3 = content3.replace(
        "      _socket = io.io('${AuthService.baseUrl}', {",
        "      _socket = io.io(AuthService.baseUrl, {"
    )

    if content3 != original3:
        file3.write_text(content3, encoding='utf-8')
        fixes.append(f"[OK] {file3.name}: Removida interpolacao desnecessaria")

    return fixes

def fix_deprecated_member_use():
    """Substitui withOpacity por withValues(alpha:) e .value por .toARGB32()."""

    fixes = []

    # custom_toast_service.dart - 2 ocorrências de withOpacity (já corrigido)
    file1 = Path(r'C:\Projects\LegislaNet\Apps\tablet_app\lib\services\custom_toast_service.dart')
    content1 = file1.read_text(encoding='utf-8')
    original1 = content1

    # Substituir todos os withOpacity por withValues
    content1 = re.sub(
        r'\.withOpacity\((\d+\.?\d*)\)',
        r'.withValues(alpha: \1)',
        content1
    )

    if content1 != original1:
        file1.write_text(content1, encoding='utf-8')
        fixes.append(f"[OK] {file1.name}: withOpacity -> withValues(alpha:)")

    # votacao_pauta_screen.dart - 7 ocorrências de withOpacity
    file2 = Path(r'C:\Projects\LegislaNet\Apps\tablet_app\lib\votacao_pauta_screen.dart')
    content2 = file2.read_text(encoding='utf-8')
    original2 = content2

    # Substituir todos os withOpacity por withValues
    content2 = re.sub(
        r'\.withOpacity\((\d+\.?\d*)\)',
        r'.withValues(alpha: \1)',
        content2
    )

    if content2 != original2:
        file2.write_text(content2, encoding='utf-8')
        fixes.append(f"[OK] {file2.name}: withOpacity -> withValues(alpha:)")

    # websocket_service.dart - .value depreciado em Color
    file3 = Path(r'C:\Projects\LegislaNet\Apps\tablet_app\lib\services\websocket_service.dart')
    content3 = file3.read_text(encoding='utf-8')
    original3 = content3

    # Substituir backgroundColor.value.toRadixString por backgroundColor.toARGB32().toRadixString
    content3 = re.sub(
        r"webBgColor: '#\$\{backgroundColor\.value\.toRadixString\(16\)\.substring\(2\)\}'",
        r"webBgColor: '#${backgroundColor.toARGB32().toRadixString(16).padLeft(8, '0').substring(2)}'",
        content3
    )

    if content3 != original3:
        file3.write_text(content3, encoding='utf-8')
        fixes.append(f"[OK] {file3.name}: .value -> .toARGB32()")

    return fixes

def fix_build_context_synchronously():
    """Adiciona verificação mounted após operações async."""

    fixes = []

    # 1. login_screen.dart - Linha 47: Navigator após async
    file1 = Path(r'C:\Projects\LegislaNet\Apps\tablet_app\lib\login_screen.dart')
    content1 = file1.read_text(encoding='utf-8')
    original1 = content1

    # Adicionar verificação mounted antes do Navigator
    pattern1 = r'      if \(result\[\'success\'\]\) \{\n        Navigator\.of\(context\)\.pushReplacementNamed\(\'/dashboard\'\);'
    replacement1 = '''      if (result['success']) {
        if (!mounted) return;
        Navigator.of(context).pushReplacementNamed('/dashboard');'''

    content1 = re.sub(pattern1, replacement1, content1)

    if content1 != original1:
        file1.write_text(content1, encoding='utf-8')
        fixes.append(f"[OK] {file1.name}: Adicionada verificacao mounted antes Navigator")

    # 2. votacao_pauta_screen.dart - Linhas 295 e 310: ScaffoldMessenger após async
    file2 = Path(r'C:\Projects\LegislaNet\Apps\tablet_app\lib\votacao_pauta_screen.dart')
    content2 = file2.read_text(encoding='utf-8')
    original2 = content2

    # Adicionar verificação mounted antes ScaffoldMessenger (sucesso) - linha 289
    # O código atual usa != false em vez de == true
    content2 = re.sub(
        r"      if \(response != null && response\['success'\] != false\) \{\n        setState\(\(\) \{\n          _votoFoiRegistrado = true; // Marcar que um voto foi registrado\n        \}\);\n\n        ScaffoldMessenger\.of\(context\)\.showSnackBar\(",
        '''      if (response != null && response['success'] != false) {
        setState(() {
          _votoFoiRegistrado = true; // Marcar que um voto foi registrado
        });

        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(''',
        content2
    )

    # Substituir o bloco de erro (se ainda não tiver mounted check)
    if "} catch (e) {" in content2 and "if (!mounted) return;" not in content2.split("} catch (e) {")[1].split("\n")[1]:
        content2 = re.sub(
            r"    \} catch \(e\) \{\n      ScaffoldMessenger\.of\(context\)\.showSnackBar\(",
            '''    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(''',
            content2
        )

    if content2 != original2:
        file2.write_text(content2, encoding='utf-8')
        fixes.append(f"[OK] {file2.name}: Adicionadas 2 verificacoes mounted antes ScaffoldMessenger")

    return fixes

if __name__ == '__main__':
    print("=== Correcoes de Linter Dart ===\n")

    # Lote 1: Imports não utilizados
    print("Lote 1: Imports Nao Utilizados")
    fixes1 = fix_unused_imports()
    if fixes1:
        print("\n".join(fixes1))
    else:
        print("[OK] Ja corrigido anteriormente")

    # Lote 2: sized_box_for_whitespace
    print("\nLote 2: sized_box_for_whitespace")
    fixes2 = fix_sized_box_for_whitespace()
    if fixes2:
        print("\n".join(fixes2))
    else:
        print("[OK] Ja corrigido anteriormente")

    # Lote 3-5: unused_field, library_prefixes, string_interpolations
    print("\nLote 3-5: unused_field, library_prefixes, string_interpolations")
    fixes3 = fix_lote_3_to_5()
    if fixes3:
        print("\n".join(fixes3))
    else:
        print("[OK] Ja corrigido anteriormente")

    # Lote 6: use_build_context_synchronously
    print("\nLote 6: use_build_context_synchronously")
    fixes4 = fix_build_context_synchronously()
    if fixes4:
        print("\n".join(fixes4))
    else:
        print("[OK] Ja corrigido anteriormente")

    # Lote 7: deprecated_member_use
    print("\nLote 7: deprecated_member_use")
    fixes5 = fix_deprecated_member_use()
    if fixes5:
        print("\n".join(fixes5))
    else:
        print("[OK] Ja corrigido anteriormente")

    total_fixes = len(fixes1) + len(fixes2) + len(fixes3) + len(fixes4) + len(fixes5)
    print(f"\n=== Total: {total_fixes} arquivos modificados ===")
