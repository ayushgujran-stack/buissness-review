import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';
import 'package:printing/printing.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import '../../core/models/models.dart';
import '../../core/theme/app_theme.dart';

class QrManagementScreen extends StatefulWidget {
  final BranchModel branch;
  const QrManagementScreen({super.key, required this.branch});

  @override
  State<QrManagementScreen> createState() => _QrManagementScreenState();
}

class _QrManagementScreenState extends State<QrManagementScreen> {
  String? _secureToken;
  String? _qrDocId;
  bool _isLoading = true;
  bool _isActive = true;

  @override
  void initState() {
    super.initState();
    _loadQrCode();
  }

  Future<void> _loadQrCode() async {
    setState(() => _isLoading = true);
    final snap = await FirebaseFirestore.instance
      .collection('qr_codes')
      .where('branch_id', isEqualTo: widget.branch.id)
      .limit(1)
      .get();

    if (snap.docs.isNotEmpty) {
      final doc = snap.docs.first;
      setState(() {
        _qrDocId = doc.id;
        _secureToken = doc.data()['secure_token'];
        _isActive = doc.data()['status'] == 'active';
        _isLoading = false;
      });
    } else {
      // Create new token
      await _regenerateToken();
    }
  }

  Future<void> _regenerateToken() async {
    setState(() => _isLoading = true);
    final now = DateTime.now().toUtc().toIso8601String();
    final newToken = 'token_${widget.branch.id.substring(0, 6)}_${DateTime.now().millisecondsSinceEpoch}';

    final ref = FirebaseFirestore.instance.collection('qr_codes').doc();
    await ref.set({
      'id': ref.id,
      'owner_id': widget.branch.ownerId,
      'business_id': widget.branch.businessId,
      'branch_id': widget.branch.id,
      'secure_token': newToken,
      'status': 'active',
      'created_at': now,
    });

    setState(() {
      _qrDocId = ref.id;
      _secureToken = newToken;
      _isActive = true;
      _isLoading = false;
    });

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('New cryptographic QR token generated successfully.')),
      );
    }
  }

  Future<void> _toggleDeactivate() async {
    if (_qrDocId == null) return;
    final newStatus = _isActive ? 'inactive' : 'active';
    await FirebaseFirestore.instance.collection('qr_codes').doc(_qrDocId).update({
      'status': newStatus,
      'deactivated_at': newStatus == 'inactive' ? DateTime.now().toUtc().toIso8601String() : null,
    });

    setState(() => _isActive = !_isActive);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('QR code is now ${_isActive ? "active" : "deactivated"}.')),
      );
    }
  }

  String get _reviewUrl {
    return 'https://reviewflow.app/review/$_secureToken';
  }

  Future<void> _printQrPoster() async {
    final pdf = pw.Document();

    pdf.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        build: (pw.Context ctx) {
          return pw.Center(
            child: pw.Column(
              mainAxisAlignment: pw.MainAxisAlignment.center,
              children: [
                pw.Text(
                  widget.branch.name,
                  style: pw.TextStyle(fontSize: 28, fontWeight: pw.FontWeight.bold),
                ),
                pw.SizedBox(height: 12),
                pw.Text(
                  'Scan to Share Your Experience',
                  style: const pw.TextStyle(fontSize: 18, color: PdfColors.grey700),
                ),
                pw.SizedBox(height: 36),
                pw.BarcodeWidget(
                  barcode: pw.Barcode.qrCode(),
                  data: _reviewUrl,
                  width: 240,
                  height: 240,
                ),
                pw.SizedBox(height: 36),
                pw.Text(
                  'Powered by ReviewFlow',
                  style: const pw.TextStyle(fontSize: 12, color: PdfColors.grey500),
                ),
              ],
            ),
          );
        },
      ),
    );

    await Printing.layoutPdf(onLayout: (format) async => pdf.save());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('${widget.branch.name} QR'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 400),
                  child: Card(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: _isActive ? AppColors.goodLight : AppColors.poorLight,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              _isActive ? 'QR ACTIVE' : 'QR DEACTIVATED',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: _isActive ? AppColors.good : AppColors.poor,
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            widget.branch.name,
                            textAlign: TextAlign.center,
                            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 6),
                          const Text(
                            'Customers scan this to open your private review form in their browser.',
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 12, color: AppColors.textSecondaryLight),
                          ),
                          const SizedBox(height: 24),
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(16),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.04),
                                  blurRadius: 10,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: QrImageView(
                              data: _reviewUrl,
                              version: QrVersions.auto,
                              size: 200.0,
                            ),
                          ),
                          const SizedBox(height: 16),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            decoration: BoxDecoration(
                              color: AppColors.backgroundLight,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              _reviewUrl,
                              textAlign: TextAlign.center,
                              style: const TextStyle(fontSize: 11, color: AppColors.textSecondaryLight),
                            ),
                          ),
                          const SizedBox(height: 24),
                          Row(
                            children: [
                              Expanded(
                                child: OutlinedButton.icon(
                                  onPressed: () => Share.share('Share your feedback: $_reviewUrl'),
                                  icon: const Icon(Icons.share_outlined, size: 18),
                                  label: const Text('Share'),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: ElevatedButton.icon(
                                  onPressed: _printQrPoster,
                                  icon: const Icon(Icons.print_outlined, size: 18),
                                  label: const Text('Print Poster'),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              Expanded(
                                child: TextButton(
                                  onPressed: _toggleDeactivate,
                                  child: Text(
                                    _isActive ? 'Deactivate QR' : 'Activate QR',
                                    style: TextStyle(color: _isActive ? AppColors.poor : AppColors.good),
                                  ),
                                ),
                              ),
                              Expanded(
                                child: TextButton(
                                  onPressed: _regenerateToken,
                                  child: const Text('Regenerate Token'),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
    );
  }
}
