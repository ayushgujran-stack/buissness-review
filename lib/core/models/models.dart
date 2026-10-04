
enum UserRole { superAdmin, owner, admin, manager, superManager }

extension UserRoleExtension on UserRole {
  String get value {
    switch (this) {
      case UserRole.superAdmin:
        return 'SUPER_ADMIN';
      case UserRole.owner:
        return 'OWNER';
      case UserRole.admin:
        return 'ADMIN';
      case UserRole.manager:
        return 'MANAGER';
      case UserRole.superManager:
        return 'SUPER_MANAGER';
    }
  }

  static UserRole fromString(String? role) {
    switch (role?.toUpperCase()) {
      case 'SUPER_ADMIN':
        return UserRole.superAdmin;
      case 'OWNER':
        return UserRole.owner;
      case 'ADMIN':
        return UserRole.admin;
      case 'MANAGER':
        return UserRole.manager;
      case 'SUPER_MANAGER':
        return UserRole.superManager;
      default:
        return UserRole.owner;
    }
  }
}

class AppPermissions {
  static const String viewDashboard = 'VIEW_DASHBOARD';
  static const String viewReviews = 'VIEW_REVIEWS';
  static const String viewCustomers = 'VIEW_CUSTOMERS';
  static const String viewReports = 'VIEW_REPORTS';
  static const String receiveAlerts = 'RECEIVE_ALERTS';
  static const String manageBusiness = 'MANAGE_BUSINESS';
  static const String manageBranch = 'MANAGE_BRANCH';
  static const String manageForms = 'MANAGE_FORMS';
  static const String manageQr = 'MANAGE_QR';
  static const String manageTeam = 'MANAGE_TEAM';
  static const String manageLicense = 'MANAGE_LICENSE';
  static const String managePayments = 'MANAGE_PAYMENTS';
  static const String exportData = 'EXPORT_DATA';

  static const List<String> allOperationalPermissions = [
    viewDashboard,
    viewReviews,
    viewCustomers,
    viewReports,
    receiveAlerts,
    manageBusiness,
    manageBranch,
    manageForms,
    manageQr,
    manageTeam,
    manageLicense,
    managePayments,
    exportData,
  ];

  static const List<String> defaultManagerPermissions = [
    viewDashboard,
    viewReviews,
    viewCustomers,
    viewReports,
    receiveAlerts,
  ];
}

class UserModel {
  final String id;
  final String authUid;
  final UserRole role;
  final String ownerId;
  final String name;
  final String email;
  final String mobile;
  final String status;
  final bool forcePasswordChange;
  final List<String> allowedBusinessIds;
  final List<String> allowedBranchIds;
  final List<String> permissions;

  UserModel({
    required this.id,
    required this.authUid,
    required this.role,
    required this.ownerId,
    required this.name,
    required this.email,
    required this.mobile,
    this.status = 'active',
    this.forcePasswordChange = false,
    this.allowedBusinessIds = const [],
    this.allowedBranchIds = const [],
    this.permissions = const [],
  });

  bool get isActive => status == 'active';

  bool hasPermission(String permission) {
    if (role == UserRole.superAdmin || role == UserRole.owner) {
      return true;
    }
    return permissions.contains(permission);
  }

  bool canAccessBusiness(String businessId) {
    if (role == UserRole.superAdmin || role == UserRole.owner) {
      return true;
    }
    return allowedBusinessIds.isEmpty || allowedBusinessIds.contains(businessId);
  }

  bool canAccessBranch(String branchId) {
    if (role == UserRole.superAdmin || role == UserRole.owner) {
      return true;
    }
    return allowedBranchIds.isEmpty || allowedBranchIds.contains(branchId);
  }

  factory UserModel.fromMap(Map<String, dynamic> map, String docId) {
    return UserModel(
      id: docId,
      authUid: map['auth_uid'] ?? docId,
      role: UserRoleExtension.fromString(map['role']),
      ownerId: map['owner_id'] ?? docId,
      name: map['name'] ?? '',
      email: map['email'] ?? '',
      mobile: map['mobile'] ?? '',
      status: map['status'] ?? 'active',
      forcePasswordChange: map['force_password_change'] ?? false,
      allowedBusinessIds: List<String>.from(map['allowed_business_ids'] ?? []),
      allowedBranchIds: List<String>.from(map['allowed_branch_ids'] ?? []),
      permissions: List<String>.from(map['permissions'] ?? []),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'auth_uid': authUid,
      'role': role.value,
      'owner_id': ownerId,
      'name': name,
      'email': email,
      'mobile': mobile,
      'status': status,
      'force_password_change': forcePasswordChange,
      'allowed_business_ids': allowedBusinessIds,
      'allowed_branch_ids': allowedBranchIds,
      'permissions': permissions,
    };
  }
}

class BusinessModel {
  final String id;
  final String ownerId;
  final String name;
  final String category;
  final String? logoUrl;
  final String? description;
  final String? phone;
  final String? email;
  final String? website;
  final String? address;
  final String? city;
  final String? state;
  final String country;
  final String status;
  final bool isDemo;

  BusinessModel({
    required this.id,
    required this.ownerId,
    required this.name,
    required this.category,
    this.logoUrl,
    this.description,
    this.phone,
    this.email,
    this.website,
    this.address,
    this.city,
    this.state,
    this.country = 'India',
    this.status = 'active',
    this.isDemo = false,
  });

  factory BusinessModel.fromMap(Map<String, dynamic> map, String docId) {
    return BusinessModel(
      id: docId,
      ownerId: map['owner_id'] ?? '',
      name: map['name'] ?? '',
      category: map['category'] ?? 'General',
      logoUrl: map['logo_url'],
      description: map['description'],
      phone: map['phone'],
      email: map['email'],
      website: map['website'],
      address: map['address'],
      city: map['city'],
      state: map['state'],
      country: map['country'] ?? 'India',
      status: map['status'] ?? 'active',
      isDemo: map['is_demo'] ?? false,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'owner_id': ownerId,
      'name': name,
      'category': category,
      'logo_url': logoUrl,
      'description': description,
      'phone': phone,
      'email': email,
      'website': website,
      'address': address,
      'city': city,
      'state': state,
      'country': country,
      'status': status,
      'is_demo': isDemo,
    };
  }
}

class BranchModel {
  final String id;
  final String ownerId;
  final String businessId;
  final String name;
  final String? address;
  final String? phone;
  final String? description;
  final String? logoUrl;
  final String themeColor;
  final String status;
  final bool isDemo;

  BranchModel({
    required this.id,
    required this.ownerId,
    required this.businessId,
    required this.name,
    this.address,
    this.phone,
    this.description,
    this.logoUrl,
    this.themeColor = '#2563EB',
    this.status = 'active',
    this.isDemo = false,
  });

  factory BranchModel.fromMap(Map<String, dynamic> map, String docId) {
    return BranchModel(
      id: docId,
      ownerId: map['owner_id'] ?? '',
      businessId: map['business_id'] ?? '',
      name: map['name'] ?? '',
      address: map['address'],
      phone: map['phone'],
      description: map['description'],
      logoUrl: map['logo_url'],
      themeColor: map['theme_color'] ?? '#2563EB',
      status: map['status'] ?? 'active',
      isDemo: map['is_demo'] ?? false,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'owner_id': ownerId,
      'business_id': businessId,
      'name': name,
      'address': address,
      'phone': phone,
      'description': description,
      'logo_url': logoUrl,
      'theme_color': themeColor,
      'status': status,
      'is_demo': isDemo,
    };
  }
}

enum QuestionType { star, goodOkayPoor, mcq, yesNo, text }

extension QuestionTypeExtension on QuestionType {
  String get value {
    switch (this) {
      case QuestionType.star:
        return 'star';
      case QuestionType.goodOkayPoor:
        return 'good_okay_poor';
      case QuestionType.mcq:
        return 'mcq';
      case QuestionType.yesNo:
        return 'yes_no';
      case QuestionType.text:
        return 'text';
    }
  }

  static QuestionType fromString(String? type) {
    switch (type) {
      case 'star':
        return QuestionType.star;
      case 'good_okay_poor':
        return QuestionType.goodOkayPoor;
      case 'mcq':
        return QuestionType.mcq;
      case 'yes_no':
        return QuestionType.yesNo;
      case 'text':
        return QuestionType.text;
      default:
        return QuestionType.star;
    }
  }
}

class ReviewQuestionModel {
  final String id;
  final String formId;
  final String text;
  final QuestionType type;
  final bool required;
  final int displayOrder;
  final bool active;
  final Map<String, dynamic>? classificationConfig;
  final List<QuestionOptionModel> options;

  ReviewQuestionModel({
    required this.id,
    required this.formId,
    required this.text,
    required this.type,
    this.required = true,
    this.displayOrder = 1,
    this.active = true,
    this.classificationConfig,
    this.options = const [],
  });

  factory ReviewQuestionModel.fromMap(
    Map<String, dynamic> map,
    String docId, {
    List<QuestionOptionModel> options = const [],
  }) {
    return ReviewQuestionModel(
      id: docId,
      formId: map['form_id'] ?? '',
      text: map['text'] ?? '',
      type: QuestionTypeExtension.fromString(map['type']),
      required: map['required'] ?? true,
      displayOrder: map['display_order'] ?? 1,
      active: map['active'] ?? true,
      classificationConfig: map['classification_config'],
      options: options,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'form_id': formId,
      'text': text,
      'type': type.value,
      'required': required,
      'display_order': displayOrder,
      'active': active,
      'classification_config': classificationConfig,
    };
  }
}

class QuestionOptionModel {
  final String id;
  final String questionId;
  final String text;
  final int displayOrder;
  final String classification; // GOOD, OKAY, POOR, NONE

  QuestionOptionModel({
    required this.id,
    required this.questionId,
    required this.text,
    this.displayOrder = 1,
    this.classification = 'NONE',
  });

  factory QuestionOptionModel.fromMap(Map<String, dynamic> map, String docId) {
    return QuestionOptionModel(
      id: docId,
      questionId: map['question_id'] ?? '',
      text: map['text'] ?? '',
      displayOrder: map['display_order'] ?? 1,
      classification: map['classification'] ?? 'NONE',
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'question_id': questionId,
      'text': text,
      'display_order': displayOrder,
      'classification': classification,
    };
  }
}

class ReviewFormModel {
  final String id;
  final String ownerId;
  final String businessId;
  final String branchId;
  final String name;
  final String? description;
  final String status; // draft, published
  final int publishedVersion;

  ReviewFormModel({
    required this.id,
    required this.ownerId,
    required this.businessId,
    required this.branchId,
    required this.name,
    this.description,
    this.status = 'published',
    this.publishedVersion = 1,
  });

  factory ReviewFormModel.fromMap(Map<String, dynamic> map, String docId) {
    return ReviewFormModel(
      id: docId,
      ownerId: map['owner_id'] ?? '',
      businessId: map['business_id'] ?? '',
      branchId: map['branch_id'] ?? '',
      name: map['name'] ?? '',
      description: map['description'],
      status: map['status'] ?? 'published',
      publishedVersion: map['published_version'] ?? 1,
    );
  }
}

class ReviewModel {
  final String id;
  final String ownerId;
  final String businessId;
  final String branchId;
  final String formId;
  final String qrId;
  final String customerId;
  final String classification; // GOOD, OKAY, POOR
  final double averageScore;
  final String submittedAt;

  ReviewModel({
    required this.id,
    required this.ownerId,
    required this.businessId,
    required this.branchId,
    required this.formId,
    required this.qrId,
    required this.customerId,
    required this.classification,
    required this.averageScore,
    required this.submittedAt,
  });

  factory ReviewModel.fromMap(Map<String, dynamic> map, String docId) {
    return ReviewModel(
      id: docId,
      ownerId: map['owner_id'] ?? '',
      businessId: map['business_id'] ?? '',
      branchId: map['branch_id'] ?? '',
      formId: map['form_id'] ?? '',
      qrId: map['qr_id'] ?? '',
      customerId: map['customer_id'] ?? '',
      classification: map['classification'] ?? 'GOOD',
      averageScore: (map['average_score'] is num) ? (map['average_score'] as num).toDouble() : 3.0,
      submittedAt: map['submitted_at'] ?? '',
    );
  }
}

class ReviewAnswerModel {
  final String id;
  final String reviewId;
  final String questionId;
  final String questionTextSnapshot;
  final String questionType;
  final dynamic answerValue;
  final String classification;
  final int? score;

  ReviewAnswerModel({
    required this.id,
    required this.reviewId,
    required this.questionId,
    required this.questionTextSnapshot,
    required this.questionType,
    required this.answerValue,
    required this.classification,
    this.score,
  });

  factory ReviewAnswerModel.fromMap(Map<String, dynamic> map, String docId) {
    return ReviewAnswerModel(
      id: docId,
      reviewId: map['review_id'] ?? '',
      questionId: map['question_id'] ?? '',
      questionTextSnapshot: map['question_text_snapshot'] ?? '',
      questionType: map['question_type'] ?? 'star',
      answerValue: map['answer_value'],
      classification: map['classification'] ?? 'NONE',
      score: map['score'],
    );
  }
}

class LicenseModel {
  final String id;
  final String ownerId;
  final String planId;
  final String status; // trial, active, expired
  final String startDate;
  final String expiryDate;
  final int maximumBranches;

  LicenseModel({
    required this.id,
    required this.ownerId,
    required this.planId,
    required this.status,
    required this.startDate,
    required this.expiryDate,
    required this.maximumBranches,
  });

  bool get isExpired => DateTime.tryParse(expiryDate)?.isBefore(DateTime.now()) ?? false;
  int get daysRemaining {
    final exp = DateTime.tryParse(expiryDate);
    if (exp == null) return 0;
    final diff = exp.difference(DateTime.now()).inDays;
    return diff > 0 ? diff : 0;
  }

  factory LicenseModel.fromMap(Map<String, dynamic> map, String docId) {
    return LicenseModel(
      id: docId,
      ownerId: map['owner_id'] ?? '',
      planId: map['plan_id'] ?? 'trial',
      status: map['status'] ?? 'trial',
      startDate: map['start_date'] ?? '',
      expiryDate: map['expiry_date'] ?? '',
      maximumBranches: map['maximum_branches'] ?? 1,
    );
  }
}
