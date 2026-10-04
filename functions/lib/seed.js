"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDemoSeed = runDemoSeed;
const config_1 = require("./config");
async function runDemoSeed() {
    console.log('--- Starting ReviewFlow Demo Data Seeding ---');
    const now = new Date();
    const nowIso = now.toISOString();
    // 1. Create Default License Plans
    const trialPlanRef = config_1.db.collection('license_plans').doc('plan_trial');
    const trialPlan = {
        id: 'plan_trial',
        name: '15-Day Free Trial',
        description: 'Explore all ReviewFlow features across up to 3 active branches.',
        price: 0,
        currency: 'INR',
        duration_days: 15,
        maximum_branches: 3,
        is_trial: true,
        status: 'active',
        created_at: nowIso,
        updated_at: nowIso
    };
    await trialPlanRef.set(trialPlan);
    const growthPlanRef = config_1.db.collection('license_plans').doc('plan_growth');
    const growthPlan = {
        id: 'plan_growth',
        name: 'Growth Plan',
        description: 'Up to 10 active branches across unlimited businesses.',
        price: 4999,
        currency: 'INR',
        duration_days: 365,
        maximum_branches: 10,
        is_trial: false,
        status: 'active',
        created_at: nowIso,
        updated_at: nowIso
    };
    await growthPlanRef.set(growthPlan);
    // 2. Create Initial Super Admin Profile
    const superAdminUid = 'super_admin_reviewflow';
    const superAdminRef = config_1.db.collection('users').doc(superAdminUid);
    const superAdmin = {
        id: superAdminUid,
        auth_uid: superAdminUid,
        role: 'SUPER_ADMIN',
        owner_id: superAdminUid,
        name: 'Platform Super Admin',
        email: 'admin@reviewflow.app',
        mobile: '9999999999',
        status: 'active',
        force_password_change: true,
        created_at: nowIso,
        updated_at: nowIso
    };
    await superAdminRef.set(superAdmin);
    // 3. Create Demo Owner "Raj"
    const ownerUid = 'demo_owner_raj';
    const ownerRef = config_1.db.collection('users').doc(ownerUid);
    const ownerProfile = {
        id: ownerUid,
        auth_uid: ownerUid,
        role: 'OWNER',
        owner_id: ownerUid,
        name: 'Raj',
        email: 'raj@reviewflow.demo',
        mobile: '9876543210',
        status: 'active',
        created_at: nowIso,
        updated_at: nowIso
    };
    await ownerRef.set(ownerProfile);
    // 4. Create Active License for Raj (Growth Plan, 10 branches)
    const licenseRef = config_1.db.collection('licenses').doc('license_demo_raj');
    const rajLicense = {
        id: 'license_demo_raj',
        owner_id: ownerUid,
        plan_id: 'plan_growth',
        status: 'active',
        start_date: nowIso,
        expiry_date: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        maximum_branches: 10,
        created_at: nowIso,
        updated_at: nowIso
    };
    await licenseRef.set(rajLicense);
    // 5. Create 3 Demo Businesses for Raj
    const businessesData = [
        {
            id: 'biz_royal_spice',
            name: 'Royal Spice Restaurant',
            category: 'Restaurant & Dining',
            description: 'Authentic Indian fine dining with signature flavors.',
            city: 'Mumbai',
            state: 'Maharashtra',
            country: 'India',
            branches: [
                { id: 'branch_rs_main', name: 'Royal Spice — Main Branch', themeColor: '#DC2626' },
                { id: 'branch_rs_city', name: 'Royal Spice — City Center', themeColor: '#B91C1C' },
                { id: 'branch_rs_mall', name: 'Royal Spice — Mall Branch', themeColor: '#991B1B' }
            ]
        },
        {
            id: 'biz_grand_horizon',
            name: 'Grand Horizon Hotel',
            category: 'Hospitality & Luxury Hotels',
            description: '5-Star business hotel and luxury suites.',
            city: 'Bengaluru',
            state: 'Karnataka',
            country: 'India',
            branches: [
                { id: 'branch_gh_main', name: 'Grand Horizon — Main Hotel', themeColor: '#2563EB' },
                { id: 'branch_gh_airport', name: 'Grand Horizon — Airport', themeColor: '#1D4ED8' }
            ]
        },
        {
            id: 'biz_urban_cuts',
            name: 'Urban Cuts Salon',
            category: 'Beauty & Grooming',
            description: 'Premium hair styling, spa and grooming lounge.',
            city: 'Delhi',
            state: 'Delhi',
            country: 'India',
            branches: [
                { id: 'branch_uc_main', name: 'Urban Cuts — Main Branch', themeColor: '#059669' }
            ]
        }
    ];
    for (const b of businessesData) {
        const bRef = config_1.db.collection('businesses').doc(b.id);
        const bRecord = {
            id: b.id,
            owner_id: ownerUid,
            name: b.name,
            category: b.category,
            description: b.description,
            city: b.city,
            state: b.state,
            country: b.country,
            status: 'active',
            created_at: nowIso,
            updated_at: nowIso,
            is_demo: true
        };
        await bRef.set(bRecord);
        // Create Branches, QR codes, and Review Forms
        for (const br of b.branches) {
            const brRef = config_1.db.collection('branches').doc(br.id);
            const brRecord = {
                id: br.id,
                owner_id: ownerUid,
                business_id: b.id,
                name: br.name,
                theme_color: br.themeColor,
                status: 'active',
                created_at: nowIso,
                updated_at: nowIso,
                is_demo: true
            };
            await brRef.set(brRecord);
            // QR Code
            const qrRef = config_1.db.collection('qr_codes').doc(`qr_${br.id}`);
            const qrToken = `token_${br.id}`;
            const qrRecord = {
                id: qrRef.id,
                owner_id: ownerUid,
                business_id: b.id,
                branch_id: br.id,
                secure_token: qrToken,
                status: 'active',
                created_at: nowIso,
                is_demo: true
            };
            await qrRef.set(qrRecord);
            // Review Form
            const formRef = config_1.db.collection('review_forms').doc(`form_${br.id}`);
            const formRecord = {
                id: formRef.id,
                owner_id: ownerUid,
                business_id: b.id,
                branch_id: br.id,
                name: `${br.name} Customer Experience Survey`,
                description: 'We value your experience. Please share your candid feedback.',
                status: 'published',
                published_version: 1,
                created_at: nowIso,
                updated_at: nowIso,
                published_at: nowIso,
                is_demo: true
            };
            await formRef.set(formRecord);
            // Form Page
            const pageRef = config_1.db.collection('review_form_pages').doc(`page_${br.id}_1`);
            const pageRecord = {
                id: pageRef.id,
                owner_id: ownerUid,
                form_id: formRef.id,
                page_number: 1,
                title: 'Overall Experience',
                description: 'Tell us how we did today',
                display_order: 1
            };
            await pageRef.set(pageRecord);
            // 4 Standard Questions across question types
            const q1Ref = config_1.db.collection('review_questions').doc(`q_${br.id}_star`);
            const q1 = {
                id: q1Ref.id,
                owner_id: ownerUid,
                form_id: formRef.id,
                page_id: pageRef.id,
                text: 'How would you rate the service today?',
                type: 'star',
                required: true,
                display_order: 1,
                active: true,
                created_at: nowIso,
                updated_at: nowIso
            };
            await q1Ref.set(q1);
            const q2Ref = config_1.db.collection('review_questions').doc(`q_${br.id}_gop`);
            const q2 = {
                id: q2Ref.id,
                owner_id: ownerUid,
                form_id: formRef.id,
                page_id: pageRef.id,
                text: 'Cleanliness and Ambiance',
                type: 'good_okay_poor',
                required: true,
                display_order: 2,
                active: true,
                created_at: nowIso,
                updated_at: nowIso
            };
            await q2Ref.set(q2);
            const q3Ref = config_1.db.collection('review_questions').doc(`q_${br.id}_yn`);
            const q3 = {
                id: q3Ref.id,
                owner_id: ownerUid,
                form_id: formRef.id,
                page_id: pageRef.id,
                text: 'Would you recommend us to friends and colleagues?',
                type: 'yes_no',
                required: true,
                display_order: 3,
                active: true,
                classification_config: { positiveAnswer: true },
                created_at: nowIso,
                updated_at: nowIso
            };
            await q3Ref.set(q3);
            const q4Ref = config_1.db.collection('review_questions').doc(`q_${br.id}_text`);
            const q4 = {
                id: q4Ref.id,
                owner_id: ownerUid,
                form_id: formRef.id,
                page_id: pageRef.id,
                text: 'Any additional thoughts or suggestions for the team?',
                type: 'text',
                required: false,
                display_order: 4,
                active: true,
                created_at: nowIso,
                updated_at: nowIso
            };
            await q4Ref.set(q4);
            // Seed 3 realistic reviews per branch (Good, Okay, and Poor)
            await seedSampleReviews({
                ownerId: ownerUid,
                businessId: b.id,
                branchId: br.id,
                formId: formRef.id,
                qrId: qrRef.id,
                qStar: q1,
                qGop: q2,
                qYn: q3,
                qText: q4
            });
        }
    }
    console.log('--- Demo Data Seeding Complete ---');
    return { success: true, message: 'Raj demo data seeded successfully.' };
}
async function seedSampleReviews(params) {
    const { ownerId, businessId, branchId, formId, qrId, qStar, qGop, qYn, qText } = params;
    const samples = [
        {
            name: 'Aditi Sharma',
            mobile: '9820011223',
            star: 5,
            gop: 'GOOD',
            yn: true,
            text: 'Wonderful experience, staff was courteous and attentive!',
            classification: 'GOOD',
            avg: 3.0
        },
        {
            name: 'Rohan Mehta',
            mobile: '9833099887',
            star: 3,
            gop: 'OKAY',
            yn: true,
            text: 'Average experience. Service took a little longer than expected.',
            classification: 'OKAY',
            avg: 2.0
        },
        {
            name: 'Vikram Singh',
            mobile: '9819077665',
            star: 1,
            gop: 'POOR',
            yn: false,
            text: 'Unacceptable wait time and billing confusion.',
            classification: 'POOR',
            avg: 1.0
        }
    ];
    for (const s of samples) {
        const now = new Date().toISOString();
        const custRef = config_1.db.collection('customers').doc();
        await custRef.set({
            id: custRef.id,
            owner_id: ownerId,
            name: s.name,
            mobile: s.mobile,
            created_at: now,
            updated_at: now
        });
        const revRef = config_1.db.collection('reviews').doc();
        await revRef.set({
            id: revRef.id,
            owner_id: ownerId,
            business_id: businessId,
            branch_id: branchId,
            form_id: formId,
            form_version: 1,
            qr_id: qrId,
            customer_id: custRef.id,
            classification: s.classification,
            average_score: s.avg,
            submitted_at: now,
            created_at: now,
            is_demo: true
        });
        // Save answers
        await config_1.db.collection('review_answers').add({
            review_id: revRef.id,
            question_id: qStar.id,
            question_text_snapshot: qStar.text,
            question_type: 'star',
            answer_value: s.star,
            classification: s.classification,
            score: s.star <= 2 ? 1 : s.star === 3 ? 2 : 3
        });
        await config_1.db.collection('review_answers').add({
            review_id: revRef.id,
            question_id: qGop.id,
            question_text_snapshot: qGop.text,
            question_type: 'good_okay_poor',
            answer_value: s.gop,
            classification: s.classification,
            score: s.gop === 'POOR' ? 1 : s.gop === 'OKAY' ? 2 : 3
        });
        await config_1.db.collection('review_answers').add({
            review_id: revRef.id,
            question_id: qYn.id,
            question_text_snapshot: qYn.text,
            question_type: 'yes_no',
            answer_value: s.yn,
            classification: s.yn ? 'GOOD' : 'POOR',
            score: s.yn ? 3 : 1
        });
        if (s.text) {
            await config_1.db.collection('review_answers').add({
                review_id: revRef.id,
                question_id: qText.id,
                question_text_snapshot: qText.text,
                question_type: 'text',
                answer_value: s.text,
                classification: 'NONE'
            });
        }
        // If poor review, seed notification record
        if (s.classification === 'POOR') {
            const notifRef = config_1.db.collection('notifications').doc();
            await notifRef.set({
                id: notifRef.id,
                owner_id: ownerId,
                business_id: businessId,
                branch_id: branchId,
                review_id: revRef.id,
                title: 'Poor Review Alert',
                message: `A customer submitted a poor review for this branch.`,
                type: 'POOR_REVIEW_ALERT',
                created_at: now
            });
            await config_1.db.collection('notification_recipients').add({
                notification_id: notifRef.id,
                user_id: ownerId,
                owner_id: ownerId,
                business_id: businessId,
                branch_id: branchId,
                status: 'UNREAD',
                created_at: now,
                updated_at: now
            });
        }
    }
}
// When executed directly via CLI
if (require.main === module) {
    runDemoSeed()
        .then(() => process.exit(0))
        .catch(err => {
        console.error(err);
        process.exit(1);
    });
}
//# sourceMappingURL=seed.js.map