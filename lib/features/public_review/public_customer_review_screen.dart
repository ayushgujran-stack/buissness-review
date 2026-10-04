import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../core/models/models.dart';
import '../../core/theme/app_theme.dart';

class PublicCustomerReviewScreen extends StatefulWidget {
  final String token;
  const PublicCustomerReviewScreen({super.key, required this.token});

  @override
  State<PublicCustomerReviewScreen> createState() => _PublicCustomerReviewScreenState();
}

class _PublicCustomerReviewScreenState extends State<PublicCustomerReviewScreen> {
  bool _isLoading = true;
  bool _isSubmitted = false;
  String? _errorMessage;

  String? _branchName;
  String? _businessName;
  String? _branchThemeColor;
  String? _formId;
  int _formVersion = 1;
  String? _ownerId;
  String? _businessId;
  String? _branchId;
  String? _qrId;

  List<ReviewQuestionModel> _questions = [];
  final Map<String, dynamic> _answers = {};

  final _nameController = TextEditingController();
  final _mobileController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  @override
  void initState() {
    super.initState();
    _loadPublicForm();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _mobileController.dispose();
    super.dispose();
  }

  Future<void> _loadPublicForm() async {
    setState(() => _isLoading = true);
    try {
      // 1. Resolve QR token
      final qrSnap = await FirebaseFirestore.instance
          .collection('qr_codes')
          .where('secure_token', isEqualTo: widget.token)
          .where('status', isEqualTo: 'active')
          .limit(1)
          .get();

      if (qrSnap.docs.isEmpty) {
        throw Exception('This QR code is invalid or has been deactivated.');
      }

      final qrDoc = qrSnap.docs.first;
      _qrId = qrDoc.id;
      final qrData = qrDoc.data();
      _ownerId = qrData['owner_id'];
      _businessId = qrData['business_id'];
      _branchId = qrData['branch_id'];

      // 2. Validate License
      final licenseSnap = await FirebaseFirestore.instance
          .collection('licenses')
          .where('owner_id', isEqualTo: _ownerId)
          .where('status', whereIn: ['trial', 'active'])
          .limit(1)
          .get();

      if (licenseSnap.docs.isEmpty) {
        throw Exception('Review submissions are currently unavailable.');
      }

      final licenseData = licenseSnap.docs.first.data();
      final expiry = DateTime.tryParse(licenseData['expiry_date'] ?? '');
      if (expiry != null && expiry.isBefore(DateTime.now())) {
        throw Exception('Review submissions are disabled because the business subscription has expired.');
      }

      // 3. Fetch Business & Branch
      final bizDoc = await FirebaseFirestore.instance.collection('businesses').doc(_businessId).get();
      _businessName = bizDoc.data()?['name'] ?? 'ReviewFlow Partner';

      final brDoc = await FirebaseFirestore.instance.collection('branches').doc(_branchId).get();
      _branchName = brDoc.data()?['name'] ?? 'Main Location';
      _branchThemeColor = brDoc.data()?['theme_color'] ?? '#2563EB';

      // 4. Fetch Published Form
      final formSnap = await FirebaseFirestore.instance
          .collection('review_forms')
          .where('branch_id', isEqualTo: _branchId)
          .where('status', isEqualTo: 'published')
          .limit(1)
          .get();

      if (formSnap.docs.isEmpty) {
        throw Exception('No feedback form published for this location yet.');
      }

      final formDoc = formSnap.docs.first;
      _formId = formDoc.id;
      _formVersion = formDoc.data()['published_version'] ?? 1;

      // 5. Fetch Questions
      final qSnap = await FirebaseFirestore.instance
          .collection('review_questions')
          .where('form_id', isEqualTo: _formId)
          .where('active', isEqualTo: true)
          .orderBy('display_order', descending: false)
          .get();

      _questions = qSnap.docs.map((d) => ReviewQuestionModel.fromMap(d.data(), d.id)).toList();

      // Initialize default answers
      for (final q in _questions) {
        if (q.type == QuestionType.star) {
          _answers[q.id] = 5;
        } else if (q.type == QuestionType.goodOkayPoor) {
          _answers[q.id] = 'GOOD';
        } else if (q.type == QuestionType.yesNo) {
          _answers[q.id] = true;
        } else {
          _answers[q.id] = '';
        }
      }
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _submitFeedback() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    try {
      final now = DateTime.now().toUtc().toIso8601String();
      final cleanMobile = _mobileController.text.trim();
      final cleanName = _nameController.text.trim().isNotEmpty ? _nameController.text.trim() : 'Guest Customer';

      // 1. Calculate deterministic scores: GOOD=3, OKAY=2, POOR=1
      double totalScore = 0;
      int scoredCount = 0;

      final List<Map<String, dynamic>> answersToSave = [];

      for (final q in _questions) {
        final val = _answers[q.id];
        String sentiment = 'NONE';
        int? score;

        if (q.type == QuestionType.star) {
          final sVal = (val as num).toInt();
          if (sVal <= 2) {
            sentiment = 'POOR';
            score = 1;
          } else if (sVal == 3) {
            sentiment = 'OKAY';
            score = 2;
          } else {
            sentiment = 'GOOD';
            score = 3;
          }
          totalScore += score;
          scoredCount++;
        } else if (q.type == QuestionType.goodOkayPoor) {
          final sVal = val.toString().toUpperCase();
          sentiment = sVal;
          score = sVal == 'POOR' ? 1 : sVal == 'OKAY' ? 2 : 3;
          totalScore += score;
          scoredCount++;
        } else if (q.type == QuestionType.yesNo) {
          final isPositive = val == true;
          sentiment = isPositive ? 'GOOD' : 'POOR';
          score = isPositive ? 3 : 1;
          totalScore += score;
          scoredCount++;
        }

        answersToSave.add({
          'question_id': q.id,
          'question_text_snapshot': q.text,
          'question_type': q.type.value,
          'answer_value': val,
          'classification': sentiment,
          'score': score,
        });
      }

      final avgScore = scoredCount > 0 ? (totalScore / scoredCount) : 3.0;
      String overallClassification = 'GOOD';
      if (avgScore < 1.75) {
        overallClassification = 'POOR';
      } else if (avgScore < 2.5) {
        overallClassification = 'OKAY';
      }

      final batch = FirebaseFirestore.instance.batch();

      // 2. Customer
      final custRef = FirebaseFirestore.instance.collection('customers').doc();
      batch.set(custRef, {
        'id': custRef.id,
        'owner_id': _ownerId,
        'name': cleanName,
        'mobile': cleanMobile,
        'created_at': now,
        'updated_at': now,
      });

      // 3. Immutable Review
      final revRef = FirebaseFirestore.instance.collection('reviews').doc();
      batch.set(revRef, {
        'id': revRef.id,
        'owner_id': _ownerId,
        'business_id': _businessId,
        'branch_id': _branchId,
        'form_id': _formId,
        'form_version': _formVersion,
        'qr_id': _qrId,
        'customer_id': custRef.id,
        'classification': overallClassification,
        'average_score': double.parse(avgScore.toStringAsFixed(2)),
        'submitted_at': now,
        'created_at': now,
      });

      // 4. Review Answers
      for (final ans in answersToSave) {
        final aRef = FirebaseFirestore.instance.collection('review_answers').doc();
        batch.set(aRef, {
          'id': aRef.id,
          'review_id': revRef.id,
          ...ans,
        });
      }

      // 5. If POOR, trigger notification record
      if (overallClassification == 'POOR') {
        final notifRef = FirebaseFirestore.instance.collection('notifications').doc();
        batch.set(notifRef, {
          'id': notifRef.id,
          'owner_id': _ownerId,
          'business_id': _businessId,
          'branch_id': _branchId,
          'review_id': revRef.id,
          'title': 'Poor Review Alert',
          'message': 'A customer submitted a poor review for $_branchName.',
          'type': 'POOR_REVIEW_ALERT',
          'created_at': now,
        });

        final recRef = FirebaseFirestore.instance.collection('notification_recipients').doc();
        batch.set(recRef, {
          'id': recRef.id,
          'notification_id': notifRef.id,
          'user_id': _ownerId,
          'owner_id': _ownerId,
          'business_id': _businessId,
          'branch_id': _branchId,
          'status': 'UNREAD',
          'created_at': now,
          'updated_at': now,
        });
      }

      await batch.commit();

      setState(() {
        _isSubmitted = true;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = e.toString().replaceAll('Exception: ', '');
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (_errorMessage != null) {
      return Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.info_outline, size: 56, color: AppColors.poor),
                const SizedBox(height: 16),
                const Text('Feedback Unavailable', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                Text(_errorMessage!, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.textSecondaryLight)),
              ],
            ),
          ),
        ),
      );
    }

    if (_isSubmitted) {
      return Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.check_circle_outline_rounded, size: 72, color: AppColors.good),
                const SizedBox(height: 16),
                const Text('Thank You for Your Feedback!', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                Text('Your response has been shared directly with $_businessName.', textAlign: TextAlign.center, style: const TextStyle(color: AppColors.textSecondaryLight)),
              ],
            ),
          ),
        ),
      );
    }

    final brandColor = Color(int.tryParse(_branchThemeColor?.replaceFirst('#', '0xFF') ?? '') ?? 0xFF2563EB);

    return Scaffold(
      backgroundColor: AppColors.backgroundLight,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Center(
                          child: Container(
                            width: 14,
                            height: 14,
                            decoration: BoxDecoration(color: brandColor, shape: BoxShape.circle),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _businessName ?? 'Customer Review',
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                        ),
                        Text(
                          _branchName ?? 'Location Feedback',
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 14, color: AppColors.textSecondaryLight),
                        ),
                        const Divider(height: 32),
                        ..._questions.map((q) => _buildQuestionField(q, brandColor)),
                        const SizedBox(height: 20),
                        const Text('Your Details', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: _nameController,
                          decoration: const InputDecoration(labelText: 'Your Name (Optional)'),
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: _mobileController,
                          keyboardType: TextInputType.phone,
                          decoration: const InputDecoration(labelText: 'Mobile Number (Mandatory) *'),
                          validator: (v) => v == null || v.trim().length < 10 ? 'A valid 10-digit mobile number is required' : null,
                        ),
                        const SizedBox(height: 24),
                        ElevatedButton(
                          style: ElevatedButton.styleFrom(backgroundColor: brandColor),
                          onPressed: _submitFeedback,
                          child: const Text('Submit Feedback'),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildQuestionField(ReviewQuestionModel q, Color brandColor) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(q.text, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
          const SizedBox(height: 8),
          if (q.type == QuestionType.star)
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(5, (index) {
                final starNum = index + 1;
                final isSelected = (_answers[q.id] ?? 5) >= starNum;
                return IconButton(
                  icon: Icon(isSelected ? Icons.star_rounded : Icons.star_outline_rounded, color: Colors.amber, size: 36),
                  onPressed: () => setState(() => _answers[q.id] = starNum),
                );
              }),
            )
          else if (q.type == QuestionType.goodOkayPoor)
            Row(
              children: ['GOOD', 'OKAY', 'POOR'].map((val) {
                final isSelected = _answers[q.id] == val;
                return Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        backgroundColor: isSelected ? brandColor : Colors.transparent,
                        foregroundColor: isSelected ? Colors.white : AppColors.textPrimaryLight,
                      ),
                      onPressed: () => setState(() => _answers[q.id] = val),
                      child: Text(val, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                    ),
                  ),
                );
              }).toList(),
            )
          else if (q.type == QuestionType.yesNo)
            Row(
              children: [true, false].map((val) {
                final isSelected = _answers[q.id] == val;
                return Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        backgroundColor: isSelected ? brandColor : Colors.transparent,
                        foregroundColor: isSelected ? Colors.white : AppColors.textPrimaryLight,
                      ),
                      onPressed: () => setState(() => _answers[q.id] = val),
                      child: Text(val ? 'Yes' : 'No', style: const TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ),
                );
              }).toList(),
            )
          else
            TextFormField(
              maxLines: 3,
              decoration: const InputDecoration(hintText: 'Share any additional details...'),
              onChanged: (val) => _answers[q.id] = val,
            ),
        ],
      ),
    );
  }
}
