import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { HeaderComponent } from '../../../Core/Components/Header/header.component';
import { MessageService } from 'primeng/api';
import { Subject } from '../models/subjects';
import { SubjectService } from '../services/subjects.service';

@Component({
  selector: 'app-list-subjects',
  standalone: true,
  providers: [MessageService],
  imports: [
    CommonModule,
    RouterModule,
    ButtonModule,
    DialogModule,
    FormsModule,
    InputTextModule,
    HeaderComponent,
  ],
  templateUrl: './list-subjects.component.html',
  styleUrls: ['./list-subjects.component.css'],
})
export class ListSubjectsComponent implements OnInit {
  subjects: Subject[] = [];
  searchTerm: string = '';
  showSubjectModal: boolean = false;
  showDeleteModal: boolean = false;
  editingSubject: boolean = false;
  subjectToDelete: Subject | null = null;

  subjectData: Subject = {
    id: '',
    code: '',
    name: '',
  };

  constructor(
    private router: Router,
    private messageService: MessageService,
    private subjectService: SubjectService
  ) {}

  /* ==================== INIT ==================== */
  ngOnInit() {
    this.loadSubjects();
  }

  /* ==================== CARGAR MATERIAS ==================== */
  loadSubjects() {
    this.subjectService.getAllSubjects().subscribe({
      next: (data) => {
        this.subjects = data;
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar las materias.',
        });
      },
    });
  }

  /* ==================== FILTRO ==================== */
  get filteredSubjects() {
    if (!this.searchTerm) return this.subjects;
    return this.subjects.filter((s) =>
      s.name.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
  }

  /* ==================== CREAR / EDITAR ==================== */
  onCreateSubject() {
    this.editingSubject = false;
    this.subjectData = { id: '', code: '', name: '' };
    this.showSubjectModal = true;
  }

  onEditSubject(subject: Subject) {
    this.editingSubject = true;
    this.subjectData = { ...subject };
    this.showSubjectModal = true;
  }

  cancelSubjectModal() {
    this.showSubjectModal = false;
    this.subjectData = { id: '',  code: '', name: '' };
  }

  confirmSubjectModal() {
    if (!this.subjectData.code || !this.subjectData.name) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Campos incompletos',
        detail: 'Debes llenar todos los campos.',
      });
      return;
    }

    if (this.editingSubject) {
      this.subjectService
        .updateSubject(this.subjectData.code, this.subjectData)
        .subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Actualizada',
              detail: 'La materia fue actualizada correctamente.',
            });
            this.loadSubjects();
            this.showSubjectModal = false;
          },
          error: () => {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'No se pudo actualizar la materia.',
            });
          },
        });
    } else {
      this.subjectService.createSubject(this.subjectData).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Creada',
            detail: 'La materia fue creada correctamente.',
          });
          this.loadSubjects();
          this.showSubjectModal = false;
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo crear la materia.',
          });
        },
      });
    }
  }

  /* ==================== ELIMINAR ==================== */
  onDeleteSubject(subject: Subject) {
    this.subjectToDelete = subject;
    this.showDeleteModal = true;
  }

  cancelDelete() {
    this.showDeleteModal = false;
    this.subjectToDelete = null;
  }

  confirmDelete() {
    if (!this.subjectToDelete) return;

    this.subjectService.deleteSubject(this.subjectToDelete.code).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Eliminada',
          detail: `La materia ${this.subjectToDelete?.name} fue eliminada correctamente.`,
        });
        this.loadSubjects();
        this.showDeleteModal = false;
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo eliminar la materia.',
        });
      },
    });
  }

  /* ==================== NAVEGACIÓN ==================== */
  onViewEnterprises() {
    this.router.navigate(['/enterprise/list']);
  }
}
