# Macedo SI - CRM System PRD

## Problem Statement
Sistema CRM (Macedo SI) originalmente usando MongoDB e SQLite. A migração completa para MySQL (MariaDB) foi solicitada, mantendo toda a funcionalidade existente.

## Core Requirements
- Migrar todas as operações de banco de dados de MongoDB/SQLite para MySQL (MariaDB)
- Manter a interface frontend React sem alterações visuais
- Preservar todas as funcionalidades CRUD existentes
- Garantir que o login e autenticação funcionem corretamente

## Architecture
- **Frontend**: React + Tailwind CSS (porta 3000)
- **Backend**: FastAPI + Python 3.11 (porta 8001)
- **Database**: MySQL (MariaDB) via SQLAlchemy + aiomysql
- **Compatibility Layer**: `database_compat.py` traduz operações MongoDB para SQL

## Tech Stack
- FastAPI, SQLAlchemy, aiomysql, pymysql
- React, axios, Tailwind CSS
- MariaDB (MySQL compatible)
- Supervisor para gerenciamento de serviços

## Key Files
- `/app/backend/server.py` - FastAPI entrypoint com middleware HTTPS
- `/app/backend/database_compat.py` - Camada de compatibilidade MongoDB → SQL
- `/app/backend/database_adapter.py` - CRUD SQL operations
- `/app/backend/models_sql.py` - SQLAlchemy models
- `/app/backend/database_sql.py` - SQLAlchemy engine setup

## What's Been Implemented
- [x] Instalação e configuração do MariaDB via supervisor (persistente)
- [x] Migração completa de MongoDB/SQLite para MySQL
- [x] Camada de compatibilidade (CompatCollection, CompatCursor)
- [x] Suporte a `await` e `async for` em find() e aggregate()
- [x] Correção de mixed content (HTTPS redirect middleware)
- [x] Correção de todos os endpoints do dashboard (clients, financial-stats, tasks-stats)
- [x] Correção de enum mismatches nos modelos (trabalhista, fiscal, client)
- [x] Seeding de dados de exemplo (10 clientes, 27 contas a receber, 2 usuários)
- [x] Todas as rotas migradas de `database` (MongoDB) para `database_compat` (SQL)

## Remaining Tasks / Backlog
- [ ] P2: Refatorar `database_compat.py` - remover a camada de compatibilidade e usar queries SQLAlchemy nativas nas rotas
- [ ] P2: Minor React hydration warning (div inside p tag in Dashboard StatCard)
- [ ] P3: Limpeza de arquivos legados (backup files, MongoDB-related scripts)

## Users
- Admin: admin@macedosi.com / admin123
- Colaborador: colaborador@macedosi.com / teste123
