from flask import Blueprint, request, jsonify
from config.firebase import db
from middleware.auth import require_auth, require_admin
from datetime import datetime

tasks_bp = Blueprint('tasks', __name__)

# GET todas las tasks (público desde frontend, pero autenticado desde backend)
@tasks_bp.route('/tasks', methods=['GET'])
@require_auth
def get_tasks():
    """Obtiene todas las tasks activas"""
    try:
        tasks_ref = db.collection('task')
        tasks = tasks_ref.where('isActive', '==', True).stream()
        
        tasks_list = []
        for task in tasks:
            task_data = task.to_dict()
            task_data['id'] = task.id
            tasks_list.append(task_data)
        
        return jsonify(tasks_list), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# GET una task específica
@tasks_bp.route('/tasks/<task_id>', methods=['GET'])
@require_auth
def get_task(task_id):
    """Obtiene una task por ID"""
    try:
        task_ref = db.collection('task').document(task_id)
        task = task_ref.get()
        
        if not task.exists:
            return jsonify({'error': 'Task no encontrada'}), 404
        
        task_data = task.to_dict()
        task_data['id'] = task.id
        
        return jsonify(task_data), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# POST crear nueva task (solo admins)
@tasks_bp.route('/tasks', methods=['POST'])
@require_admin
def create_task():
    """Crea una nueva task"""
    try:
        data = request.json
        
        # Validaciones básicas
        required_fields = ['name', 'category', 'platform', 'template']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Campo requerido: {field}'}), 400
        
        # Agregar metadata
        task_data = {
            **data,
            'metadata': {
                'version': data.get('version', '1.0.0'),
                'createdAt': datetime.utcnow().isoformat(),
                'updatedAt': datetime.utcnow().isoformat(),
                'createdBy': request.uid
            },
            'isActive': True
        }
        
        # Crear documento con ID personalizado o auto-generado
        task_id = data.get('id', None)
        if task_id:
            db.collection('task').document(task_id).set(task_data)
        else:
            task_ref = db.collection('task').add(task_data)
            task_id = task_ref[1].id
        
        return jsonify({'id': task_id, 'message': 'Task creada exitosamente'}), 201
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# PUT actualizar task (solo admins)
@tasks_bp.route('/tasks/<task_id>', methods=['PUT'])
@require_admin
def update_task(task_id):
    """Actualiza una task existente"""
    try:
        data = request.json
        task_ref = db.collection('task').document(task_id)
        
        if not task_ref.get().exists:
            return jsonify({'error': 'Task no encontrada'}), 404
        
        # Actualizar metadata
        update_data = {
            **data,
            'metadata.updatedAt': datetime.utcnow().isoformat()
        }
        
        task_ref.update(update_data)
        
        return jsonify({'message': 'Task actualizada exitosamente'}), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# DELETE eliminar task (solo admins) - soft delete
@tasks_bp.route('/tasks/<task_id>', methods=['DELETE'])
@require_admin
def delete_task(task_id):
    """Desactiva una task (soft delete)"""
    try:
        task_ref = db.collection('task').document(task_id)
        
        if not task_ref.get().exists:
            return jsonify({'error': 'Task no encontrada'}), 404
        
        task_ref.update({
            'isActive': False,
            'metadata.updatedAt': datetime.utcnow().isoformat()
        })
        
        return jsonify({'message': 'Task desactivada exitosamente'}), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500