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

      final List<ReviewQuestionModel> loadedQuestions = [];

      for (var qDoc in questionsSnap.docs) {
        final qData = qDoc.data();
        final optionsSnap = await FirebaseFirestore.instance
            .collection('question_options')
            .where('question_id', isEqualTo: qDoc.id)
            .orderBy('display_order', descending: false)
            .get();

        final options = optionsSnap.docs
            .map((optDoc) => QuestionOptionModel.fromMap(optDoc.data(), optDoc.id))
            .toList();

        loadedQuestions.add(ReviewQuestionModel.fromMap(qData, qDoc.id, options: options));
      }

      _questions = loadedQuestions;
    }
    if (mounted) setState(() => _isLoading = false);
  }

  void _openAddQuestionDialog() {
    final textCtrl = TextEditingController();
    QuestionType type = QuestionType.star;
    bool required = true;
    final List<Map<String, String>> mcqOptions = [
      {'text': 'Excellent', 'classification': 'GOOD'},
      {'text': 'Average', 'classification': 'OKAY'},
      {'text': 'Needs Improvement', 'classification': 'POOR'},
    ];

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
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Add Review Question', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                        IconButton(
                          icon: const Icon(Icons.close),
                          onPressed: () => Navigator.pop(ctx),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: textCtrl,
                      decoration: const InputDecoration(labelText: 'Question Prompt *'),
                    ),
                    const SizedBox(height: 14),
                    const Text('Question Type', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<QuestionType>(
                      initialValue: type,
                      decoration: const InputDecoration(),
                      items: const [
                        DropdownMenuItem(value: QuestionType.star, child: Text('5-Star Rating')),
                        DropdownMenuItem(value: QuestionType.goodOkayPoor, child: Text('Good / Okay / Poor')),
                        DropdownMenuItem(value: QuestionType.mcq, child: Text('Multiple Choice (MCQ)')),
                        DropdownMenuItem(value: QuestionType.yesNo, child: Text('Yes / No Choice')),
                        DropdownMenuItem(value: QuestionType.text, child: Text('Text Feedback (Optional comment)')),
                      ],
                      onChanged: (val) => setModalState(() => type = val ?? QuestionType.star),
                    ),
                    const SizedBox(height: 12),

                    // MCQ Options Builder
                    if (type == QuestionType.mcq) ...[
                      const Text('MCQ Options & Classification', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 6),
                      ...List.generate(mcqOptions.length, (index) {
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Row(
                            children: [
                              Expanded(
                                flex: 3,
                                child: TextFormField(
                                  initialValue: mcqOptions[index]['text'],
                                  decoration: InputDecoration(
                                    labelText: 'Option ${index + 1}',
                                    isDense: true,
                                  ),
                                  onChanged: (val) => mcqOptions[index]['text'] = val,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                flex: 2,
                                child: DropdownButtonFormField<String>(
                                  initialValue: mcqOptions[index]['classification'],
                                  isDense: true,
                                  decoration: const InputDecoration(),
                                  items: const [
                                    DropdownMenuItem(value: 'GOOD', child: Text('Good')),
                                    DropdownMenuItem(value: 'OKAY', child: Text('Okay')),
                                    DropdownMenuItem(value: 'POOR', child: Text('Poor')),
                                    DropdownMenuItem(value: 'NONE', child: Text('Neutral')),
                                  ],
                                  onChanged: (val) {
                                    setModalState(() => mcqOptions[index]['classification'] = val ?? 'NONE');
                                  },
                                ),
                              ),
                              IconButton(
                                icon: const Icon(Icons.remove_circle_outline, color: AppColors.poor, size: 20),
                                onPressed: () {
                                  if (mcqOptions.length > 2) {
                                    setModalState(() => mcqOptions.removeAt(index));
                                  }
                                },
                              ),
                            ],
                          ),
                        );
                      }),
                      TextButton.icon(
                        onPressed: () {
                          setModalState(() {
                            mcqOptions.add({'text': 'New Option', 'classification': 'NONE'});
                          });
                        },
                        icon: const Icon(Icons.add, size: 16),
                        label: const Text('Add Option'),
                      ),
                      const SizedBox(height: 10),
                    ],

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
                        final batch = FirebaseFirestore.instance.batch();

                        final qRef = FirebaseFirestore.instance.collection('review_questions').doc();
                        final newQ = ReviewQuestionModel(
                          id: qRef.id,
                          formId: _formId!,
                          text: textCtrl.text.trim(),
                          type: type,
                          required: required,
                          displayOrder: _questions.length + 1,
                        );

                        batch.set(qRef, newQ.toMap()..['owner_id'] = widget.branch.ownerId..['created_at'] = now..['updated_at'] = now);

                        if (type == QuestionType.mcq) {
                          for (int i = 0; i < mcqOptions.length; i++) {
                            final optRef = FirebaseFirestore.instance.collection('question_options').doc();
                            batch.set(optRef, {
                              'id': optRef.id,
                              'question_id': qRef.id,
                              'text': mcqOptions[i]['text'] ?? '',
                              'display_order': i + 1,
                              'classification': mcqOptions[i]['classification'] ?? 'NONE',
                              'active': true,
                              'created_at': now,
                            });
                          }
                        }

                        await batch.commit();

                        if (mounted) {
                          nav.pop();
                          _loadForm();
                        }
                      },
                      child: const Text('Add Question'),
                    ),
                  ],
                ),
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

  Future<void> _duplicateForm() async {
    if (_formId == null) return;
    final now = DateTime.now().toUtc().toIso8601String();
    final newFormRef = FirebaseFirestore.instance.collection('review_forms').doc();
    final batch = FirebaseFirestore.instance.batch();

    batch.set(newFormRef, {
      'id': newFormRef.id,
      'owner_id': widget.branch.ownerId,
      'business_id': widget.branch.businessId,
      'branch_id': widget.branch.id,
      'name': '${widget.branch.name} Form (Copy)',
      'status': 'draft',
      'published_version': 1,
      'created_at': now,
      'updated_at': now,
    });

    for (var q in _questions) {
      final newQRef = FirebaseFirestore.instance.collection('review_questions').doc();
      batch.set(newQRef, {
        'id': newQRef.id,
        'owner_id': widget.branch.ownerId,
        'form_id': newFormRef.id,
        'text': q.text,
        'type': q.type.value,
        'required': q.required,
        'display_order': q.displayOrder,
        'active': q.active,
        'created_at': now,
        'updated_at': now,
      });

      for (var opt in q.options) {
        final newOptRef = FirebaseFirestore.instance.collection('question_options').doc();
        batch.set(newOptRef, {
          'id': newOptRef.id,
          'question_id': newQRef.id,
          'text': opt.text,
          'display_order': opt.displayOrder,
          'classification': opt.classification,
          'active': true,
          'created_at': now,
        });
      }
    }

    await batch.commit();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Form duplicated successfully as draft!')),
      );
    }
  }

  void _showFormPreview() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surfaceLight,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return Container(
          height: MediaQuery.of(ctx).size.height * 0.85,
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.preview_rounded, color: AppColors.brandPrimary),
                      const SizedBox(width: 8),
                      Text('Customer Preview (v$_version)', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                    ],
                  ),
                  IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx)),
                ],
              ),
              const Divider(),
              Expanded(
                child: ListView.separated(
                  itemCount: _questions.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 16),
                  itemBuilder: (context, i) {
                    final q = _questions[i];
                    return Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${i + 1}. ${q.text}${q.required ? " *" : ""}',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                            ),
                            const SizedBox(height: 12),
                            if (q.type == QuestionType.star)
                              const Row(
                                children: [
                                  Icon(Icons.star_rounded, color: Colors.amber, size: 32),
                                  Icon(Icons.star_rounded, color: Colors.amber, size: 32),
                                  Icon(Icons.star_rounded, color: Colors.amber, size: 32),
                                  Icon(Icons.star_rounded, color: Colors.amber, size: 32),
                                  Icon(Icons.star_rounded, color: Colors.amber, size: 32),
                                ],
                              ),
                            if (q.type == QuestionType.goodOkayPoor)
                              const Row(
                                mainAxisAlignment: MainAxisAlignment.spaceAround,
                                children: [
                                  Chip(avatar: Icon(Icons.sentiment_satisfied_alt, color: AppColors.good), label: Text('Good')),
                                  Chip(avatar: Icon(Icons.sentiment_neutral, color: AppColors.okay), label: Text('Okay')),
                                  Chip(avatar: Icon(Icons.sentiment_dissatisfied, color: AppColors.poor), label: Text('Poor')),
                                ],
                              ),
                            if (q.type == QuestionType.yesNo)
                              const Row(
                                mainAxisAlignment: MainAxisAlignment.spaceAround,
                                children: [
                                  Chip(label: Text('Yes')),
                                  Chip(label: Text('No')),
                                ],
                              ),
                            if (q.type == QuestionType.mcq)
                              Wrap(
                                spacing: 8,
                                children: q.options.map((opt) => Chip(label: Text(opt.text))).toList(),
                              ),
                            if (q.type == QuestionType.text)
                              const TextField(
                                enabled: false,
                                decoration: InputDecoration(hintText: 'Customer enters feedback here...'),
                              ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('${widget.branch.name} Form'),
        actions: [
          IconButton(
            icon: const Icon(Icons.copy_rounded),
            tooltip: 'Duplicate Form',
            onPressed: _duplicateForm,
          ),
          IconButton(
            icon: const Icon(Icons.visibility_outlined),
            tooltip: 'Preview Form',
            onPressed: _showFormPreview,
          ),
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
                              '${q.type.value.toUpperCase()}${q.options.isNotEmpty ? " (${q.options.length} options)" : ""} • ${q.required ? "Required" : "Optional"}',
                              style: const TextStyle(fontSize: 12, color: AppColors.textSecondaryLight),
                            ),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                IconButton(
                                  icon: const Icon(Icons.delete_outline, color: AppColors.poor, size: 18),
                                  tooltip: 'Delete Question',
                                  onPressed: () async {
                                    await FirebaseFirestore.instance.collection('review_questions').doc(q.id).delete();
                                    _loadForm();
                                  },
                                ),
                                const Icon(Icons.drag_handle_rounded, color: AppColors.textMutedLight),
                              ],
                            ),
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
