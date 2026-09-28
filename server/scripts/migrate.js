'use strict';
const {migrate,DB_PATH}=require('../db'); migrate(); console.log(`Migrated ${DB_PATH}`);

