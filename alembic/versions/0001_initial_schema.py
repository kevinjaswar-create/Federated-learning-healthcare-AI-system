"""Initial PostgreSQL Schema for Federated Learning Healthcare AI

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-09-21 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0001_initial_schema'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Hospitals Table
    op.create_table(
        'hospitals',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('hospital_name', sa.String(length=255), nullable=False),
        sa.Column('hospital_code', sa.String(length=50), nullable=False),
        sa.Column('location', sa.String(length=255), nullable=False),
        sa.Column('contact_email', sa.String(length=255), nullable=False),
        sa.Column('status', sa.String(length=50), server_default='ACTIVE', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('hospital_code', name='uq_hospitals_code'),
        sa.CheckConstraint("status IN ('ACTIVE', 'INACTIVE', 'TRAINING', 'OFFLINE')", name='check_hospital_status')
    )
    op.create_index('ix_hospitals_id', 'hospitals', ['id'], unique=False)
    op.create_index('ix_hospitals_hospital_code', 'hospitals', ['hospital_code'], unique=True)
    op.create_index('idx_hospitals_code_status', 'hospitals', ['hospital_code', 'status'], unique=False)

    # 2. Users Table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('hospital_id', sa.Integer(), nullable=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=50), server_default='DOCTOR', nullable=False),
        sa.Column('status', sa.String(length=50), server_default='ACTIVE', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['hospital_id'], ['hospitals.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email', name='uq_users_email'),
        sa.CheckConstraint("role IN ('SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR')", name='check_user_role'),
        sa.CheckConstraint("status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')", name='check_user_status')
    )
    op.create_index('ix_users_id', 'users', ['id'], unique=False)
    op.create_index('ix_users_email', 'users', ['email'], unique=True)
    op.create_index('ix_users_hospital_id', 'users', ['hospital_id'], unique=False)
    op.create_index('idx_users_role_status', 'users', ['role', 'status'], unique=False)

    # 3. Datasets Table (Privacy Preserved: Metadata only, no raw records stored centrally)
    op.create_table(
        'datasets',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('hospital_id', sa.Integer(), nullable=False),
        sa.Column('dataset_name', sa.String(length=255), nullable=False),
        sa.Column('record_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('feature_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('status', sa.String(length=50), server_default='VALIDATED', nullable=False),
        sa.Column('file_path', sa.String(length=500), nullable=True),
        sa.Column('schema_info', sa.JSON(), nullable=True),
        sa.Column('uploaded_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['hospital_id'], ['hospitals.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint("status IN ('PENDING', 'VALIDATED', 'FAILED', 'PREPROCESSED')", name='check_dataset_status'),
        sa.CheckConstraint('record_count >= 0', name='check_record_count_non_negative')
    )
    op.create_index('ix_datasets_id', 'datasets', ['id'], unique=False)
    op.create_index('ix_datasets_hospital_id', 'datasets', ['hospital_id'], unique=False)
    op.create_index('idx_datasets_hospital_status', 'datasets', ['hospital_id', 'status'], unique=False)

    # 4. Training Runs Table
    op.create_table(
        'training_runs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('hospital_id', sa.Integer(), nullable=False),
        sa.Column('round_number', sa.Integer(), nullable=True),
        sa.Column('model_version', sa.String(length=50), nullable=False),
        sa.Column('training_samples', sa.Integer(), server_default='0', nullable=False),
        sa.Column('accuracy', sa.Float(), nullable=True),
        sa.Column('precision', sa.Float(), nullable=True),
        sa.Column('recall', sa.Float(), nullable=True),
        sa.Column('f1_score', sa.Float(), nullable=True),
        sa.Column('loss', sa.Float(), nullable=True),
        sa.Column('status', sa.String(length=50), server_default='PENDING', nullable=False),
        sa.Column('metrics_json', sa.JSON(), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['hospital_id'], ['hospitals.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint("status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED')", name='check_training_run_status')
    )
    op.create_index('ix_training_runs_id', 'training_runs', ['id'], unique=False)
    op.create_index('ix_training_runs_hospital_id', 'training_runs', ['hospital_id'], unique=False)
    op.create_index('ix_training_runs_round_number', 'training_runs', ['round_number'], unique=False)
    op.create_index('ix_training_runs_model_version', 'training_runs', ['model_version'], unique=False)
    op.create_index('idx_training_hospital_round', 'training_runs', ['hospital_id', 'round_number'], unique=False)

    # 5. Federated Rounds Table
    op.create_table(
        'federated_rounds',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('round_number', sa.Integer(), nullable=False),
        sa.Column('participating_hospitals', sa.JSON(), nullable=False),
        sa.Column('completed_hospitals', sa.JSON(), nullable=False),
        sa.Column('failed_hospitals', sa.JSON(), nullable=False),
        sa.Column('global_model_version', sa.String(length=50), nullable=False),
        sa.Column('aggregation_method', sa.String(length=50), server_default='FedAvg', nullable=False),
        sa.Column('status', sa.String(length=50), server_default='PENDING', nullable=False),
        sa.Column('global_metrics', sa.JSON(), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('round_number', name='uq_federated_rounds_round_number'),
        sa.CheckConstraint("status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')", name='check_federated_round_status')
    )
    op.create_index('ix_federated_rounds_id', 'federated_rounds', ['id'], unique=False)
    op.create_index('ix_federated_rounds_round_number', 'federated_rounds', ['round_number'], unique=True)
    op.create_index('idx_federated_rounds_status', 'federated_rounds', ['status'], unique=False)

    # 6. Models Table
    op.create_table(
        'models',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('model_name', sa.String(length=255), nullable=False),
        sa.Column('model_version', sa.String(length=50), nullable=False),
        sa.Column('model_type', sa.String(length=50), server_default='LogisticRegression', nullable=False),
        sa.Column('accuracy', sa.Float(), nullable=True),
        sa.Column('precision', sa.Float(), nullable=True),
        sa.Column('recall', sa.Float(), nullable=True),
        sa.Column('f1_score', sa.Float(), nullable=True),
        sa.Column('storage_path', sa.String(length=500), nullable=True),
        sa.Column('parameters_summary', sa.JSON(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('status', sa.String(length=50), server_default='READY', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('model_version', name='uq_models_model_version'),
        sa.CheckConstraint("status IN ('READY', 'TRAINING', 'DEPRECATED')", name='check_model_status')
    )
    op.create_index('ix_models_id', 'models', ['id'], unique=False)
    op.create_index('ix_models_model_version', 'models', ['model_version'], unique=True)
    op.create_index('ix_models_is_active', 'models', ['is_active'], unique=False)
    op.create_index('idx_models_active_version', 'models', ['is_active', 'model_version'], unique=False)

    # 7. Predictions Table
    op.create_table(
        'predictions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('hospital_id', sa.Integer(), nullable=True),
        sa.Column('model_version', sa.String(length=50), nullable=False),
        sa.Column('input_features', sa.JSON(), nullable=False),
        sa.Column('prediction_result', sa.String(length=100), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['hospital_id'], ['hospitals.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('confidence >= 0.0 AND confidence <= 1.0', name='check_prediction_confidence_range')
    )
    op.create_index('ix_predictions_id', 'predictions', ['id'], unique=False)
    op.create_index('ix_predictions_hospital_id', 'predictions', ['hospital_id'], unique=False)
    op.create_index('ix_predictions_model_version', 'predictions', ['model_version'], unique=False)
    op.create_index('ix_predictions_created_at', 'predictions', ['created_at'], unique=False)
    op.create_index('idx_predictions_hospital_created', 'predictions', ['hospital_id', 'created_at'], unique=False)

    # 8. Audit Logs Table
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('action', sa.String(length=100), nullable=False),
        sa.Column('resource', sa.String(length=100), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('metadata_json', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint("status IN ('SUCCESS', 'FAILURE', 'UNAUTHORIZED')", name='check_audit_status')
    )
    op.create_index('ix_audit_logs_id', 'audit_logs', ['id'], unique=False)
    op.create_index('ix_audit_logs_user_id', 'audit_logs', ['user_id'], unique=False)
    op.create_index('ix_audit_logs_action', 'audit_logs', ['action'], unique=False)
    op.create_index('ix_audit_logs_timestamp', 'audit_logs', ['timestamp'], unique=False)
    op.create_index('idx_audit_action_timestamp', 'audit_logs', ['action', 'timestamp'], unique=False)


def downgrade() -> None:
    op.drop_table('audit_logs')
    op.drop_table('predictions')
    op.drop_table('models')
    op.drop_table('federated_rounds')
    op.drop_table('training_runs')
    op.drop_table('datasets')
    op.drop_table('users')
    op.drop_table('hospitals')
