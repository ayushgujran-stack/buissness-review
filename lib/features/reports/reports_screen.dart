import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing/printing.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:csv/csv.dart';
import 'package:share_plus/share_plus.dart';
import '../../core/models/models.dart';
import '../../core/providers/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/context_switchers.dart';

class ReportsScreen extends ConsumerStatefulWidget {
  const ReportsScreen({super.key});

  @override
  ConsumerState<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends ConsumerState<ReportsScreen> {
  String _selectedRange = 'Daily'; // Daily, Weekly, Monthly

  Future<void> _exportPdf(List<ReviewModel> reviews) async {
    final pdf = pw.Document();

    pdf.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        build: (pw.Context ctx) => [
          pw.Header(level: 0, text: 'ReviewFlow Customer Experience Report'),
          pw.Paragraph(text: 'Generated on: ${DateTime.now().toLocal().toString().split(".")[0]}'),
          pw.Paragraph(text: 'Total Reviews Analyzed: ${reviews.length}'),
          pw.SizedBox(height: 12),
          pw.TableHelper.fromTextArray(
            headers: ['ID', 'Branch', 'Score', 'Classification', 'Date'],
            data: reviews.map((r) => [
              r.id.substring(0, 6),
              r.branchId,
              '${r.averageScore.toStringAsFixed(1)} / 3.0',
              r.classification,
              r.submittedAt.split('T').first,
            ]).toList(),
          ),
        ],
      ),
    );

    await Printing.layoutPdf(onLayout: (format) async => pdf.save());
  }

  void _exportCsv(List<ReviewModel> reviews) {
    final List<List<dynamic>> rows = [
      ['Review ID', 'Branch ID', 'Classification', 'Average Score', 'Submitted At'],
      ...reviews.map((r) => [r.id, r.branchId, r.classification, r.averageScore, r.submittedAt]),
    ];

    final csvData = const ListToCsvConverter().convert(rows);
    Share.share(csvData, subject: 'ReviewFlow_Report.csv');
  }

  @override
  Widget build(BuildContext context) {
    final reviewsAsync = ref.watch(reviewsStreamProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Reports', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: const [
          Padding(padding: EdgeInsets.only(right: 12), child: BusinessSwitcherButton()),
        ],
      ),
      body: reviewsAsync.when(
        data: (reviews) {
          return Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Generate Report', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                const SizedBox(height: 6),
                const Text('Export customer feedback and performance reports in multiple formats.', style: TextStyle(color: AppColors.textSecondaryLight, fontSize: 13)),
                const SizedBox(height: 20),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Select Frequency', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                        const SizedBox(height: 8),
                        Row(
                          children: ['Daily', 'Weekly', 'Monthly'].map((range) {
                            final isSel = _selectedRange == range;
                            return Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: ChoiceChip(
                                label: Text(range),
                                selected: isSel,
                                onSelected: (_) => setState(() => _selectedRange = range),
                              ),
                            );
                          }).toList(),
                        ),
                        const SizedBox(height: 16),
                        Text('Total Reviews Available for Export: ${reviews.length}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                        const SizedBox(height: 20),
                        Row(
                          children: [
                            Expanded(
                              child: ElevatedButton.icon(
                                onPressed: reviews.isEmpty ? null : () => _exportPdf(reviews),
                                icon: const Icon(Icons.picture_as_pdf_outlined, size: 18),
                                label: const Text('Export PDF'),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: OutlinedButton.icon(
                                onPressed: reviews.isEmpty ? null : () => _exportCsv(reviews),
                                icon: const Icon(Icons.table_chart_outlined, size: 18),
                                label: const Text('Export CSV'),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
      ),
    );
  }
}
