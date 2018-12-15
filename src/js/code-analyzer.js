import * as esprima from 'esprima';
import * as escodegen from 'escodegen';


let params=[];
let argsValues=[];
const parseCode = (codeToParse) => {
    return esprima.parseScript(codeToParse);
};

const makeTable  =(code) => {
    let jsonData = esprima.parseScript(code ,{loc:true});
    return parseBody(jsonData.body);

};
export {parseCode, makeTable, makeDoubleArray, makeTableHTML, parseProgram };
function  makeDoubleArray( array) {
    let doubleArray = [];
    for (let i = 0; i < array.length; i++) {
        let tmpArr = [array[i].line, array[i].type, array[i].name, array[i].condition, array[i].value];
        doubleArray.push(tmpArr);
    }
    return doubleArray;
}

function makeTableHTML(myArray) {
    var result = '<table border=1>';
    result+='<thead><tr>' +
        '<th>Line</th>'+
        '<th>Type</th>'+
        '<th>Name</th>'+
        '<th>Condition</th>'+
        '<th>Value</th>'+
        '</tr></thead>';
    for(let i=0; i<myArray.length; i++) {
        result += '<tr>';
        for(let j=0; j<myArray[i].length; j++){
            result += '<td>'+myArray[i][j]+'</td>';
        }
        result += '</tr>';
    }
    result += '</table>';

    return result;
}
function parseFunctionDeclaration(func , env) {
    parseFunctionParams(func.params, env);
    func.body.body=parseBody(func.body.body, env);
    func.body.body=func.body.body.filter(exp=>exp);
    return func;
}

function parseFunctionParams(parameters, env){
    for(let i=0; i<parameters.length; i=i+1){
        params.push(parameters[i].name);
        env[parameters[i].name]= argsValues[i].right;
    }
}


function parseVariableDeclaration(vardecl, env) {
    for (let i = 0; i < vardecl.declarations.length; i++) {
        if (vardecl.declarations[i].init.type === 'ArrayExpression') {
            let right = vardecl.declarations[i].init.elements;
            for(let i=0; i<right.length; i=i+1){
                right[i]= substitute(right[i], env);
            }
            vardecl.declarations[i].init = right;
            env[vardecl.declarations[i].id.name] = right;
        }
        else {
            let right = substitute(vardecl.declarations[i].init, env);
            vardecl.declarations[i].init = right;
            env[vardecl.declarations[i].id.name] = right;
        }
    }
    return null;

}

function parseWhileStatement(program, env){
    let newEnv = deepCopyEnv(env);
    program.test= substitute(program.test, newEnv);
    let test1=JSON.parse(JSON.stringify(program.test));
    let val=substituteEval(test1,newEnv);
    let value = eval(escodegen.generate(val));
    let color ='red';
    if(value){
        color='green';
    }
    program.test.color = color;
    if(program.body.type==='BlockStatement') {
        program.body.body = parseBody(program.body.body, newEnv);
        program.body.body = program.body.body.filter(exp => exp);
    }
    else {
        program.body = (parseBody([program.body], newEnv))[0];
    }
    return program;
}

function parseIfStatement(bodyElement, isElseIf, env) {
    let newEnv = deepCopyEnv(env);
    bodyElement.test =parseBody(bodyElement.test);
    bodyElement.test= substitute(bodyElement.test, newEnv);
    let test1=JSON.parse(JSON.stringify(bodyElement.test));
    let val=substituteEval(test1,newEnv);
    let value = eval(escodegen.generate(val));
    let color ='red';
    if(value)
        color='green';
    bodyElement.test.color = color;
    if (bodyElement.consequent.type === 'BlockStatement') {
        bodyElement.consequent.body = parseBody(bodyElement.consequent.body, env);
        let z= bodyElement.consequent.body.filter(exp=>exp);
        bodyElement.consequent.body=z;
    }
    else
        bodyElement.consequent = parseBody([bodyElement.consequent], env)[0];
    let typeAlt = bodyElement.alternate.type;
    if (typeAlt === 'IfStatement')
        bodyElement.alternate = parseIfStatement(bodyElement.alternate, true, newEnv);
    else {
        bodyElement.alternate.body = parseBody(bodyElement.alternate.body, newEnv);
        let k = bodyElement.alternate.body.filter(exp => exp);
        bodyElement.alternate.body = k;
    }
    return bodyElement;
}

function parseExpressionStatement(bodyElement, env){
    return parseBody([bodyElement.expression], env);
}

function parseReturnStatement(retStatement, env) {
    retStatement = substitute(retStatement.argument, env);
    return retStatement;
}

function parseAssignmentExpression(assignExp, env) {
    let name;
    if (assignExp.left.type === 'MemberExpression') {
        name = assignExp.left.object.name;
        assignExp.left.property = substitute(assignExp.left.property);
        assignExp.right = substitute(assignExp.right, env);
        env[name][assignExp.left.property.value] = assignExp.right;
    }
    else {
        name = assignExp.left.name;
        assignExp.right = substitute(assignExp.right, env);
        env[name] = assignExp.right;
    }
    if (isFuncArgument(name))
        return assignExp;
    else
        return null;
}


function deepCopyEnv(oldEnv){
    let newEnv=[];
    for(let arg in oldEnv){
        newEnv[arg]=oldEnv[arg];
    }
    return newEnv;

}
function substitute (expr, env){
    switch (expr.type) {
    case 'BinaryExpression':
        return BinaryExpSub(expr, env, false);
    case 'Identifier':
        return identifierSub(expr, env, false);
    case 'MemberExpression':
        return memberExpSub(expr, env, false);
    case 'Literal':
        return expr;
    }

}
function substituteEval (expr, env){
    switch (expr.type) {
    case 'BinaryExpression':
        return BinaryExpSub(expr, env, true);
    case 'Identifier':
        return identifierSub(expr, env, true);
    case 'MemberExpression':
        return memberExpSub(expr, env, true);
    case 'Literal':
        return expr;
    }

}
function memberExpSub(expr, env, ifEval){
    let name=expr.object.name;
    if(ifEval) {
        expr.property = substituteEval(expr.property, env);
    }
    else
        expr.property = substitute(expr.property, env);
    if (!isFuncArgument(name)|| ifEval) {
        let tmp= env[name];
        return tmp[expr.property.value];
    }
    else {
        return expr;
    }
}

function BinaryExpSub( expr, env, IfEval){
    if(IfEval){
        expr.left = substituteEval(expr.left, env);
        expr.right = substituteEval(expr.right, env);
    }
    else {
        expr.left = substitute(expr.left, env);
        expr.right = substitute(expr.right, env);
    }
    return expr;
}

function isFuncArgument(name) {
    let exist = params.indexOf(name);
    if(exist===-1)
        return false;
    return true;
}

function identifierSub (expr, env, isEval){
    if (!isFuncArgument(expr.name)|| isEval) {
        if (env[expr.name] !== undefined) {
            return env[expr.name];
        }
    }
    else {
        return expr;
    }
}
function parseGlobal(global, env){
    for (let i = 0; i < global.declarations.length; i++) {
        if (global.declarations[i].init.type === 'ArrayExpression') {
            let right = global.declarations[i].init.elements;
            for(let i=0; i<right.length; i=i+1){
                right[i]= substitute(right[i], env);
            }
            global.declarations[i].init = right;
            env[global.declarations[i].id.name] = right;
        }
        else {
            let right = substitute(global.declarations[i].init, env);
            global.declarations[i].init = right;
            env[global.declarations[i].id.name] = right;
        }
    }
    return global;
}
function parseProgram(program, argsVals,env){
    argsValues= argsVals.body[0].expression.expressions; // returns as Expression statement
    for(let i=0; i<program.body.length; i++){
        if(program.body[i].type==='VariableDeclaration')
            program.body[i]= parseGlobal(program.body[i], env);
        else
            program.body[i]= parseBody([program.body[i]], env)[0];
    }
    return program;
}
function parseBody ( program , env ) {
    for (let i = 0; i < program.length; i++) {
        program[i]=(parsePrimitiveExps(program[i], env));
    }
    if(program.length==1&& program[0]===null)
        program=null;
    return program;
}
function parsePrimitiveExps (program , env ){
    if (program.type === 'VariableDeclaration') {
        program = parseVariableDeclaration(program, env);
    } else if (program.type === 'AssignmentExpression') {
        program = (parseAssignmentExpression(program, env));
    } else if (program.type === 'ReturnStatement') {
        program = (parseReturnStatement(program, env));
    } else if (program.type === 'ExpressionStatement') {
        program = (parseExpressionStatement(program, env));
    }
    else
        program= parseComplexExps(program, env);

    return program;
}

function parseComplexExps (program , env  ){
    let newEnv= deepCopyEnv(env);
    if (program.type === 'FunctionDeclaration') {
        program = (parseFunctionDeclaration(program, env));
    } else if (program.type === 'IfStatement') {
        program = (parseIfStatement(program, false, newEnv));
    } else if (program.type === 'WhileStatement') {
        program = (parseWhileStatement(program, newEnv));
    }
    return program;
}