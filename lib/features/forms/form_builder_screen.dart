import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../core/models/models.dart';
import '../../core/theme/app_theme.dart';

class FormBuilderScreen extends StatefulWidget {
  final BranchModel branch;
  const FormBuilderScreen({super.key, required this.branch});

  @override
  State<FormBuilderScreen> createState() => _FormBuilderScreenState();
}

class _FormBuilderScreenState extends State<FormBuilderScreen> {
  String? _formId;
  String _status = 'published';
  int _version = 1;
  bool _isLoading = true;
  List<ReviewQuestionModel> _questions = [];

  @override
  void initState() {
    super.initState();
    _loadForm();
  }

  Future<void> _loadForm() async {
    setState(() => _isLoading = true);
    final formSnap = await FirebaseFirestore.instance
      .collection('review_forms')
      .where('branch_id', isEqualTo: widget.branch.id)
      .limit(1)
      .get();

    if (formSnap.docs.isNotEmpty) {
      final doc = formSnap.docs.first;
      _formId = doc.id;
      _status = doc.data()['status'] ?? 'published';
      _version = doc.data()['published_version'] ?? 1;

      final questionsSnap = await FirebaseFirestore.instance
        .collection('review_questions')
        .where('form_id', isEqualTo: _formId)
        .orderBy('display_order', descending: false)
        .get();

      _questions = questionsSnap.docs
        .map((d) => ReviewQuestionModel.fromMap(d.data(), d.id))
        .toList();
    }
    setState(() => _isLoading = false);
  }

  void _openAddQuestionDialog() {
    final textCtrl = TextEditingController();
    QuestionType type = QuestionType.star;
    bool required = true;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surfaceLight,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
                top: 20,
                left: 20,
                right: 20,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('Add Review Question', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: textCtrl,
                    decoration: const InputDecoration(labelText: 'Question Prompt *'),
                  ),
                  const SizedBox(height: 16),
                  const Text('Question Type', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<QuestionType>(
                    initialValue: type,
                    decoration: const InputDecoration(),
                    items: const [
                      DropdownMenuItem(value: QuestionType.star, child: Text('5-Star Rating')),
                      DropdownMenuItem(value: QuestionType.goodOkayPoor, child: Text('Good / Okay / Poor')),
                      DropdownMenuItem(value: QuestionType.yesNo, child: Text('Yes / No Choice')),
                      DropdownMenuItem(value: QuestionType.text, child: Text('Text Feedback (Optional comment)')),
                    ],
                    onChanged: (val) => setModalState(() => type = val ?? QuestionType.star),
                  ),
                  const SizedBox(height: 12),
                  SwitchListTile(
                    title: const Text('Mandatory Answer'),
                    value: required,
                    contentPadding: EdgeInsets.zero,
                    onChanged: (val) => setModalState(() => required = val),
                  ),
                  const SizedBox(height: 20),
                  ElevatedButton(
                    onPressed: () async {
                      if (textCtrl.text.trim().isEmpty || _formId == null) return;
                      final nav = Navigator.of(ctx);
                      final now = DateTime.now().toUtc().toIso8601String();
                      final qRef = FirebaseFirestore.instance.collection('review_questions').doc();

                      final newQ = ReviewQuestionModel(
                        id: qRef.id,
                        formId: _formId!,
                        text: textCtrl.text.trim(),
                        type: type,
                        required: required,
                        displayOrder: _questions.length + 1,
                      );

                      await qRef.set(newQ.toMap()..['owner_id'] = widget.branch.ownerId..['created_at'] = now..['updated_at'] = now);

                      if (mounted) {
                        nav.pop();
                        _loadForm();
                      }
                    },
                    child: const Text('Add Question'),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _publishForm() async {
    if (_formId == null) return;
    final now = DateTime.now().toUtc().toIso8601String();
    await FirebaseFirestore.instance.collection('review_forms').doc(_formId).update({
      'status': 'published',
      'published_version': _version + 1,
      'published_at': now,
      'updated_at': now,
    });
    setState(() {
      _status = 'published';
      _version += 1;
    });
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Form published successfully (v$_version).')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('${widget.branch.name} Form'),
        actions: [
          TextButton.icon(
            onPressed: _publishForm,
            icon: const Icon(Icons.publish_rounded, color: AppColors.good, size: 18),
            label: Text('Publish v$_version', style: const TextStyle(color: AppColors.good, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceLight,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.borderLight),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Status: ${_status.toUpperCase()}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                            Text('Active Version: $_version', style: const TextStyle(fontSize: 12, color: AppColors.textSecondaryLight)),
                          ],
                        ),
                        ElevatedButton.icon(
                          onPressed: _openAddQuestionDialog,
                          icon: const Icon(Icons.add, size: 16),
                          label: const Text('Add Question'),
                          style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8)),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  const Text('Form Questions', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  if (_questions.isEmpty) ...[
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 40),
                      child: Center(
                        child: Text('No questions configured yet. Tap "Add Question" to begin.'),
                      ),
                    ),
                  ] else ...[
                    ReorderableListView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: _questions.length,
                      onReorderItem: (oldIndex, newIndex) {
                        setState(() {
                          final item = _questions.removeAt(oldIndex);
                          _questions.insert(newIndex, item);
                        });
                      },
                      itemBuilder: (ctx, i) {
                        final q = _questions[i];
                        return Card(
                          key: ValueKey(q.id),
                          margin: const EdgeInsets.only(bottom: 8),
                          child: ListTile(
                            leading: CircleAvatar(
                              radius: 14,
                              backgroundColor: AppColors.brandLight,
                              child: Text('${i + 1}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.brandPrimary)),
                            ),
                            title: Text(q.text, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                            subtitle: Text(
                              '${q.type.value.toUpperCase()} • ${q.required ? "Required" : "Optional"}',
                              style: const TextStyle(fontSize: 12, color: AppColors.textSecondaryLight),
                            ),
                            trailing: const Icon(Icons.drag_handle_rounded, color: AppColors.textMutedLight),
                          ),
                        );
                      },
                    ),
                  ],
                ],
              ),
            ),
    );
  }
}
